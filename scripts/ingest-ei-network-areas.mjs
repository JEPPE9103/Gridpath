/**
 * Ingest Energimarknadsinspektionen (Ei) official local-network
 * area concessions (områdeskoncessioner / lokalnät) into Grid Intelligence.
 *
 * Discovers the current lokalnät ZIP from Ei's official landing page,
 * stores a hashed source snapshot, normalizes polygons via PostGIS
 * (SWEREF99 TM / EPSG:3006 → EPSG:4326), and reports project-site matches.
 *
 * First successful import is a BASELINE: source + snapshot + grid_areas only.
 * Does not create external_changes, alerts, capacity claims, or mutate projects.
 *
 * Refuses any non-localhost Supabase target.
 *
 * Usage:
 *   npm run dev:ingest-ei-network-areas
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LANDING_URL =
  "https://ei.se/bransch/koncessioner/ansokan-natkoncession-for-omrade";
const SOURCE_NAME = "Energimarknadsinspektionen — Nätkoncessioner för område";
const SOURCE_SLUG = "ei-network-area-concessions";
const SOURCE_PUBLISHER = "Energimarknadsinspektionen";
const SOURCE_CRS = "EPSG:3006";
const SOURCE_CRS_LABEL = "SWEREF 99 TM / EPSG:3006";
const TARGET_CRS = "EPSG:4326";
const AREA_TYPE = "local_network";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supabaseCli = path.join(repoRoot, "node_modules", "supabase", "dist", "supabase.js");

function isLocalHostname(hostname) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function assertLocalUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid Supabase URL: ${rawUrl}`);
  }
  if (!isLocalHostname(parsed.hostname)) {
    throw new Error(
      `Refusing to run: this ingest is local-only. URL must be localhost or 127.0.0.1, got ${parsed.hostname}.`,
    );
  }
  return parsed.origin;
}

function parseEnvOutput(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function runSupabase(args) {
  if (!existsSync(supabaseCli)) {
    throw new Error("Local supabase CLI is missing. Run npm install first.");
  }
  try {
    return execFileSync(process.execPath, [supabaseCli, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    const detail = [error.stderr, error.stdout, error.message]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join("\n");
    throw new Error(detail || "supabase CLI command failed");
  }
}

function loadLocalConfig() {
  let status = {};
  try {
    status = parseEnvOutput(runSupabase(["status", "-o", "env"]));
  } catch (error) {
    throw new Error(
      `Could not read local Supabase status. Start it with \`npx supabase start\`.\n${error.message}`,
    );
  }
  const envUrl = process.env.SUPABASE_URL?.trim();
  const url = assertLocalUrl(envUrl || status.API_URL || "http://127.0.0.1:54321");
  if (envUrl) {
    assertLocalUrl(envUrl);
  }
  return { url };
}

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function quoteSqlNullable(value) {
  return value == null || value === "" ? "null" : quoteSql(value);
}

function queryLocal(sql) {
  const dir = mkdtempSync(path.join(tmpdir(), "noxheim-ei-ingest-"));
  const file = path.join(dir, "query.sql");
  writeFileSync(file, sql, "utf8");
  try {
    const raw = runSupabase([
      "--output-format",
      "json",
      "db",
      "query",
      "--local",
      "-f",
      file,
    ]);
    const jsonStart = raw.indexOf("{");
    if (jsonStart === -1) {
      return [];
    }
    const parsed = JSON.parse(raw.slice(jsonStart));
    return parsed.rows ?? [];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function requireRow(rows, label) {
  const row = rows[0];
  if (!row) {
    throw new Error(`Expected a row for ${label}.`);
  }
  return row;
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&ouml;/gi, "ö")
    .replace(/&auml;/gi, "ä")
    .replace(/&aring;/gi, "å")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function discoverLokalnatZipUrl(html, landingUrl) {
  const matches = html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const match of matches) {
    const attrs = match[1] ?? "";
    const hrefMatch = attrs.match(/\bhref\s*=\s*"([^"]+)"/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (!/\.zip(?:$|[?#])/i.test(href)) continue;
    const text = stripTags(match[2] ?? "").toLowerCase();
    const lokal = text.includes("lokalnät") || text.includes("lokalnat");
    const region = text.includes("regionnät") || text.includes("regionnat");
    if (lokal && !region) {
      return new URL(href, landingUrl).href;
    }
  }
  throw new Error(
    "Could not discover the official Ei lokalnät ZIP on the landing page. Refusing to use a hardcoded stale URL.",
  );
}

async function downloadBuffer(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "NOXHEIM-local-ingest/1.0 (official public GIS retrieval)",
    },
  });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const filename =
    decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "download.zip");
  return { bytes, filename, finalUrl: response.url || url };
}

function extractZip(zipBytes, destDir) {
  const zipPath = path.join(destDir, "source.zip");
  writeFileSync(zipPath, zipBytes);
  execFileSync("tar", ["-xf", zipPath, "-C", destDir], { stdio: "ignore" });
}

function findShapefileBase(dir) {
  const names = readdirSync(dir);
  const shp = names.find((name) => name.toLowerCase().endsWith(".shp"));
  if (!shp) {
    throw new Error("Official ZIP did not contain a .shp file.");
  }
  const base = shp.slice(0, -4);
  const required = [".shp", ".dbf", ".shx"];
  for (const ext of required) {
    if (!names.includes(base + ext) && !names.includes(base + ext.toLowerCase())) {
      throw new Error(`Official shapefile is missing ${ext}: ${base}${ext}`);
    }
  }
  return {
    baseName: base,
    shpPath: path.join(dir, shp),
    dbfPath: path.join(dir, names.find((name) => name === `${base}.dbf`) ?? `${base}.dbf`),
    shxPath: path.join(dir, names.find((name) => name === `${base}.shx`) ?? `${base}.shx`),
    prjPath: names.includes(`${base}.prj`) ? path.join(dir, `${base}.prj`) : null,
  };
}

function parseDbf(buffer) {
  const recordCount = buffer.readUInt32LE(4);
  const headerLen = buffer.readUInt16LE(8);
  const recordLen = buffer.readUInt16LE(10);
  const lastUpdate = {
    year: buffer[1] < 100 ? 1900 + buffer[1] : 2000 + (buffer[1] - 100),
    month: buffer[2],
    day: buffer[3],
  };
  const fields = [];
  let offset = 32;
  while (offset < headerLen - 1 && buffer[offset] !== 0x0d) {
    const rawName = buffer.slice(offset, offset + 11);
    const name = rawName.toString("utf8").replace(/\0+$/g, "").trim();
    const type = String.fromCharCode(buffer[offset + 11]);
    const length = buffer[offset + 16];
    const decimals = buffer[offset + 17];
    fields.push({ name, type, length, decimals });
    offset += 32;
  }

  const records = [];
  for (let i = 0; i < recordCount; i += 1) {
    const start = headerLen + i * recordLen;
    if (start + recordLen > buffer.length) break;
    const deleted = buffer[start] === 0x2a;
    let cursor = start + 1;
    const row = {};
    for (const field of fields) {
      const raw = buffer.slice(cursor, cursor + field.length).toString("utf8").trim();
      row[field.name] = raw;
      cursor += field.length;
    }
    records.push({ deleted, values: row });
  }

  return { fields, records, lastUpdate, recordCount };
}

function parsePrj(prjPath) {
  if (!prjPath || !existsSync(prjPath)) {
    return null;
  }
  return readFileSync(prjPath, "utf8").trim();
}

function dateFromFilename(name) {
  const match = name.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseNumber(raw) {
  if (raw == null || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function ringToWkt(points) {
  if (points.length === 0) return null;
  const closed = [...points];
  const first = closed[0];
  const last = closed[closed.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    closed.push(first);
  }
  if (closed.length < 4) return null;
  return `(${closed.map(([x, y]) => `${x.toFixed(6)} ${y.toFixed(6)}`).join(",")})`;
}

function polygonRecordToWkt(buffer, start) {
  if (start + 4 > buffer.length) {
    return { wkt: null, reason: "truncated_record" };
  }
  const type = buffer.readInt32LE(start);
  if (type === 0) {
    return { wkt: null, reason: "null_shape" };
  }
  if (type !== 5 && type !== 15 && type !== 25) {
    return { wkt: null, reason: `unsupported_shape_type_${type}` };
  }
  if (start + 44 > buffer.length) {
    return { wkt: null, reason: "truncated_polygon_header" };
  }
  const numParts = buffer.readInt32LE(start + 36);
  const numPoints = buffer.readInt32LE(start + 40);
  const partsStart = start + 44;
  const pointsStart = partsStart + numParts * 4;
  const pointStride = type === 5 ? 16 : 24;
  if (numParts < 1 || numPoints < 4 || pointsStart + numPoints * pointStride > buffer.length) {
    return { wkt: null, reason: "invalid_polygon_layout" };
  }
  const parts = [];
  for (let i = 0; i < numParts; i += 1) {
    parts.push(buffer.readInt32LE(partsStart + i * 4));
  }
  const points = [];
  for (let i = 0; i < numPoints; i += 1) {
    const px = buffer.readDoubleLE(pointsStart + i * pointStride);
    const py = buffer.readDoubleLE(pointsStart + i * pointStride + 8);
    points.push([px, py]);
  }
  const rings = [];
  for (let i = 0; i < parts.length; i += 1) {
    const from = parts[i];
    const to = i + 1 < parts.length ? parts[i + 1] : numPoints;
    const ring = ringToWkt(points.slice(from, to));
    if (ring) rings.push(ring);
  }
  if (rings.length === 0) {
    return { wkt: null, reason: "empty_rings" };
  }
  return {
    wkt: `MULTIPOLYGON(${rings.map((ring) => `(${ring})`).join(",")})`,
    reason: null,
  };
}

function readShapefilePolygons(shpBuffer, shxBuffer) {
  const fileCode = shpBuffer.readInt32BE(0);
  if (fileCode !== 9994) {
    throw new Error(`Unexpected shapefile file code ${fileCode}`);
  }
  const shapeType = shpBuffer.readInt32LE(32);
  const xmin = shpBuffer.readDoubleLE(36);
  const ymin = shpBuffer.readDoubleLE(44);
  const xmax = shpBuffer.readDoubleLE(52);
  const ymax = shpBuffer.readDoubleLE(60);

  const geometries = [];
  let skipped = 0;
  const skipReasons = {};

  function skip(reason) {
    skipped += 1;
    skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
    geometries.push(null);
  }

  if (shxBuffer) {
    const recordCount = Math.floor((shxBuffer.length - 100) / 8);
    for (let i = 0; i < recordCount; i += 1) {
      const recordOffset = shxBuffer.readInt32BE(100 + i * 8) * 2;
      const { wkt, reason } = polygonRecordToWkt(shpBuffer, recordOffset + 8);
      if (wkt) {
        geometries.push(wkt);
      } else {
        skip(reason ?? "unreadable_shape");
      }
    }
  } else {
    const fileLength = shpBuffer.readInt32BE(24) * 2;
    let offset = 100;
    while (offset + 8 <= shpBuffer.length && offset + 8 <= fileLength) {
      const contentLen = shpBuffer.readInt32BE(offset + 4) * 2;
      const start = offset + 8;
      offset = start + contentLen;
      const { wkt, reason } = polygonRecordToWkt(shpBuffer, start);
      if (wkt) {
        geometries.push(wkt);
      } else {
        skip(reason ?? "unreadable_shape");
      }
    }
  }

  return {
    shapeType,
    bbox: { xmin, ymin, xmax, ymax },
    geometries,
    skipped,
    skipReasons,
  };
}

function field(row, candidates) {
  for (const name of candidates) {
    if (row[name] != null && String(row[name]).trim() !== "") {
      return String(row[name]).trim();
    }
  }
  const keys = Object.keys(row);
  const lower = candidates.map((name) => name.toLowerCase());
  for (const key of keys) {
    if (lower.includes(key.toLowerCase()) && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }
  return null;
}

function companyFieldName(fields) {
  const names = fields.map((item) => item.name);
  return (
    names.find((name) => /f[oö]retag/i.test(name)) ??
    names.find((name) => /foretag/i.test(name)) ??
    null
  );
}

function areaName(company, concessionId) {
  if (company && concessionId) {
    return `${company} — ${concessionId}`;
  }
  return company || concessionId || "Ei local network concession";
}

function pad(value, width) {
  const text = value == null || value === "" ? "—" : String(value);
  if (text.length >= width) return text;
  return text + " ".repeat(width - text.length);
}

async function main() {
  const { url } = loadLocalConfig();
  console.log(`Ei local-network ingest against ${url}`);
  console.log("Source class: official regulator GIS (not a NOXHEIM fixture)");

  console.log(`\nDiscovering current distribution from:\n  ${LANDING_URL}`);
  const landingResponse = await fetch(LANDING_URL, {
    redirect: "follow",
    headers: {
      "user-agent": "NOXHEIM-local-ingest/1.0 (official public GIS retrieval)",
    },
  });
  if (!landingResponse.ok) {
    throw new Error(`Failed to fetch Ei landing page (${landingResponse.status})`);
  }
  const landingHtml = await landingResponse.text();
  const downloadUrl = discoverLokalnatZipUrl(landingHtml, LANDING_URL);
  console.log(`Official lokalnät ZIP discovered:\n  ${downloadUrl}`);

  const downloaded = await downloadBuffer(downloadUrl);
  const contentHash = createHash("sha256").update(downloaded.bytes).digest("hex");
  console.log(`Downloaded ${downloaded.filename} (${downloaded.bytes.length} bytes)`);
  console.log(`Content hash (SHA-256): ${contentHash}`);

  const workDir = mkdtempSync(path.join(tmpdir(), "noxheim-ei-zip-"));
  let parsed;
  try {
    extractZip(downloaded.bytes, workDir);
    const shapefile = findShapefileBase(workDir);
    const dbf = parseDbf(readFileSync(shapefile.dbfPath));
    const shp = readShapefilePolygons(
      readFileSync(shapefile.shpPath),
      existsSync(shapefile.shxPath) ? readFileSync(shapefile.shxPath) : null,
    );
    const prj = parsePrj(shapefile.prjPath);
    const publishedDate =
      dateFromFilename(shapefile.baseName) ??
      (dbf.lastUpdate.month && dbf.lastUpdate.day
        ? `${String(dbf.lastUpdate.year).padStart(4, "0")}-${String(dbf.lastUpdate.month).padStart(2, "0")}-${String(dbf.lastUpdate.day).padStart(2, "0")}`
        : null);

    if (prj && !/SWEREF99/i.test(prj)) {
      console.warn("WARNING: .prj does not mention SWEREF99; still transforming as EPSG:3006 per Ei landing-page CRS.");
    }

    parsed = {
      layerName: shapefile.baseName,
      originalFilename: downloaded.filename,
      publishedDate,
      prj,
      dbf,
      shp,
      fieldNames: dbf.fields.map((item) => item.name),
    };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  const companyKey = companyFieldName(parsed.dbf.fields);
  const retrievedAt = new Date().toISOString();
  const publishedAt = parsed.publishedDate ? `${parsed.publishedDate}T00:00:00+00:00` : null;

  console.log(`Layer: ${parsed.layerName}`);
  console.log(`Source CRS: ${SOURCE_CRS_LABEL}`);
  console.log(`Fields: ${parsed.fieldNames.join(", ")}`);
  console.log(`DBF records: ${parsed.dbf.recordCount}`);
  console.log(`Shapefile polygons read: ${parsed.shp.geometries.length}`);
  console.log(`Shapefile skipped before attributes: ${parsed.shp.skipped}`);
  if (parsed.publishedDate) {
    console.log(`Source publication/update date: ${parsed.publishedDate}`);
  }

  const grouped = new Map();
  let skipped = 0;
  let mergedExtraParts = 0;
  const skipReasons = {};

  function skip(reason) {
    skipped += 1;
    skipReasons[reason] = (skipReasons[reason] ?? 0) + 1;
  }

  const recordCount = parsed.dbf.records.length;
  if (parsed.shp.geometries.length !== recordCount) {
    console.log(
      `Note: DBF records=${recordCount}, shapefile records=${parsed.shp.geometries.length}`,
    );
  }

  for (let i = 0; i < recordCount; i += 1) {
    const record = parsed.dbf.records[i];
    if (record.deleted) {
      skip("dbf_deleted");
      continue;
    }
    const wkt = parsed.shp.geometries[i];
    if (!wkt) {
      skip("missing_geometry");
      continue;
    }
    const concessionId = field(record.values, ["KONCESSION", "Koncession", "koncession"]);
    if (!concessionId) {
      skip("missing_concession_id");
      continue;
    }
    const company = companyKey ? field(record.values, [companyKey, "FöretagNa", "Foretagsnamn"]) : null;
    const unitId = field(record.values, ["Enhet", "ENHET", "enhet"]);
    const voltage = parseNumber(field(record.values, ["Spanning", "Spänning", "spanning"]));
    const shapeLength = parseNumber(field(record.values, ["Shape_Leng", "Shape_Length"]));
    const shapeArea = parseNumber(field(record.values, ["Shape_Area"]));
    const existing = grouped.get(concessionId);
    const sourceFields = { ...record.values };
    if (existing) {
      existing.wkts.push(wkt);
      mergedExtraParts += 1;
      continue;
    }
    grouped.set(concessionId, {
      concessionId,
      company,
      unitId,
      voltage,
      shapeLength,
      shapeArea,
      sourceFields,
      wkts: [wkt],
      name: areaName(company, concessionId),
    });
  }

  queryLocal(`
insert into public.grid_sources (
  name, slug, source_type, publisher, base_url, country_code, active, authority_level, update_frequency
) values (
  ${quoteSql(SOURCE_NAME)},
  ${quoteSql(SOURCE_SLUG)},
  'gis',
  ${quoteSql(SOURCE_PUBLISHER)},
  ${quoteSql(LANDING_URL)},
  'SE',
  true,
  'official',
  'as_published'
)
on conflict (slug) do update
set
  name = excluded.name,
  source_type = excluded.source_type,
  publisher = excluded.publisher,
  base_url = excluded.base_url,
  country_code = excluded.country_code,
  authority_level = excluded.authority_level,
  active = true,
  update_frequency = excluded.update_frequency;
`);

  const source = requireRow(
    queryLocal(`
select id, name, slug, source_type, publisher, base_url, authority_level, country_code
from public.grid_sources
where slug = ${quoteSql(SOURCE_SLUG)};
`),
    "grid_sources",
  );

  const existingSnapshot = queryLocal(`
select id, retrieved_at, published_at, content_hash, status
from public.source_snapshots
where source_id = ${quoteSql(source.id)}::uuid
  and content_hash = ${quoteSql(contentHash)};
`);

  let snapshotId;
  let snapshotStatus;
  if (existingSnapshot[0]) {
    snapshotId = existingSnapshot[0].id;
    snapshotStatus = "UNCHANGED";
  } else {
    const snapshotMeta = {
      original_filename: parsed.originalFilename,
      content_length: downloaded.bytes.length,
      dataset_layer_name: parsed.layerName,
      source_crs: SOURCE_CRS_LABEL,
      target_crs: TARGET_CRS,
      feature_count: parsed.dbf.recordCount,
      unique_concession_count: grouped.size,
      source_update_date: parsed.publishedDate,
      landing_page_url: LANDING_URL,
      download_url: downloadUrl,
      distribution: "official_zip",
      field_names: parsed.fieldNames,
      prj: parsed.prj,
    };
    const inserted = requireRow(
      queryLocal(`
insert into public.source_snapshots (
  source_id, retrieved_at, published_at, content_hash, raw_content, storage_path, status, metadata
) values (
  ${quoteSql(source.id)}::uuid,
  ${quoteSql(retrievedAt)}::timestamptz,
  ${quoteSqlNullable(publishedAt)}::timestamptz,
  ${quoteSql(contentHash)},
  null,
  null,
  'success',
  ${quoteSql(JSON.stringify(snapshotMeta))}::jsonb
)
returning id, status;
`),
      "source_snapshots insert",
    );
    snapshotId = inserted.id;
    snapshotStatus = "success";
  }

  const operators = queryLocal(`
select id, name from public.grid_operators;
`);
  const operatorByName = new Map(operators.map((row) => [row.name, row.id]));

  const areas = [...grouped.values()];
  let insertedCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  let invalidCount = 0;
  const BATCH = 20;

  function upsertAreaSql(batch) {
    const valuesSql = batch
      .map((area) => {
        const operatorId = area.company ? operatorByName.get(area.company) ?? null : null;
        const metadata = {
          official_operator_name: area.company,
          concession_id: area.concessionId,
          unit_id: area.unitId,
          permitted_voltage_kv: area.voltage,
          source_fields: area.sourceFields,
          source_layer: parsed.layerName,
          source_crs: SOURCE_CRS_LABEL,
          merged_polygon_parts: area.wkts.length,
        };
        const wktArray = `ARRAY[${area.wkts.map((wkt) => quoteSql(wkt)).join(", ")}]::text[]`;
        return `(
          ${quoteSql(source.id)}::uuid,
          ${operatorId ? quoteSql(operatorId) + "::uuid" : "null::uuid"},
          ${quoteSql(area.concessionId)},
          ${quoteSql(area.name)},
          ${quoteSql(AREA_TYPE)},
          'SE',
          private.normalize_sweref99tm_multipolygons(${wktArray}),
          ${quoteSqlNullable(publishedAt)}::timestamptz,
          ${quoteSql(existingSnapshot[0]?.retrieved_at ?? retrievedAt)}::timestamptz,
          'high',
          ${quoteSql(JSON.stringify(metadata))}::jsonb
        )`;
      })
      .join(",\n");

    return `
with incoming as (
  select
    v.source_id::uuid,
    v.operator_id::uuid,
    v.external_id::text,
    v.name::text,
    v.area_type::text,
    v.country_code::text,
    v.geometry::extensions.geometry as geometry,
    v.published_at::timestamptz,
    v.retrieved_at::timestamptz,
    v.confidence::text,
    v.metadata::jsonb
  from (
    values
    ${valuesSql}
  ) as v(
    source_id, operator_id, external_id, name, area_type, country_code,
    geometry, published_at, retrieved_at, confidence, metadata
  )
),
classified as (
  select
    i.*,
    e.id as existing_id,
    case
      when i.geometry is null or extensions.st_isempty(i.geometry) then 'invalid'
      when e.id is null then 'insert'
      when e.name is not distinct from i.name
       and e.operator_id is not distinct from i.operator_id
       and e.metadata is not distinct from i.metadata
       and e.published_at is not distinct from i.published_at
       and e.geometry is not null
       and extensions.st_equals(e.geometry, i.geometry) then 'unchanged'
      else 'update'
    end as action
  from incoming as i
  left join public.grid_areas as e
    on e.source_id = i.source_id
   and e.external_id = i.external_id
)
, inserted as (
  insert into public.grid_areas (
    source_id, operator_id, external_id, name, area_type, country_code,
    geometry, published_at, retrieved_at, confidence, metadata
  )
  select
    source_id, operator_id, external_id, name, area_type, country_code,
    geometry::extensions.geometry(MultiPolygon, 4326),
    published_at, retrieved_at, confidence, metadata
  from classified
  where action = 'insert'
  returning id
)
, updated as (
  update public.grid_areas as ga
  set
    operator_id = c.operator_id,
    name = c.name,
    area_type = c.area_type,
    country_code = c.country_code,
    geometry = c.geometry::extensions.geometry(MultiPolygon, 4326),
    published_at = c.published_at,
    retrieved_at = c.retrieved_at,
    confidence = c.confidence,
    metadata = c.metadata
  from classified as c
  where c.action = 'update'
    and ga.id = c.existing_id
  returning ga.id
)
select
  (select count(*)::int from classified where action = 'insert') as inserted,
  (select count(*)::int from classified where action = 'update') as updated,
  (select count(*)::int from classified where action = 'unchanged') as unchanged,
  (select count(*)::int from classified where action = 'invalid') as invalid;
`;
  }

  function applyUpsertStats(stats) {
    insertedCount += Number(stats.inserted ?? 0);
    updatedCount += Number(stats.updated ?? 0);
    unchangedCount += Number(stats.unchanged ?? 0);
    invalidCount += Number(stats.invalid ?? 0);
  }

  function upsertBatch(batch) {
    try {
      const rows = queryLocal(upsertAreaSql(batch));
      applyUpsertStats(rows[0] ?? {});
    } catch (error) {
      if (batch.length === 1) {
        invalidCount += 1;
        skipReasons.transform_or_insert_failed =
          (skipReasons.transform_or_insert_failed ?? 0) + 1;
        console.warn(
          `  skipped concession ${batch[0].concessionId}: ${error.message.replace(/\s+/g, " ").slice(0, 500)}`,
        );
        return;
      }
      for (const area of batch) {
        upsertBatch([area]);
      }
    }
  }

  for (let i = 0; i < areas.length; i += BATCH) {
    upsertBatch(areas.slice(i, i + BATCH));
    process.stdout.write(`  areas ${Math.min(i + BATCH, areas.length)}/${areas.length}\r`);
  }
  process.stdout.write("\n");

  skipped += invalidCount;
  if (invalidCount) {
    skipReasons.invalid_after_transform = (skipReasons.invalid_after_transform ?? 0) + invalidCount;
  }

  const changeCount = requireRow(
    queryLocal(`
select count(*)::int as count
from public.external_changes
where source_id = ${quoteSql(source.id)}::uuid;
`),
    "external_changes count",
  );

  const storedAreas = requireRow(
    queryLocal(`
select
  count(*)::int as count,
  count(*) filter (where geometry is not null and not extensions.st_isempty(geometry) and extensions.st_isvalid(geometry))::int as valid
from public.grid_areas
where source_id = ${quoteSql(source.id)}::uuid
  and area_type = ${quoteSql(AREA_TYPE)};
`),
    "stored areas",
  );

  const matches = queryLocal(`
select
  p.name as project,
  round(extensions.st_y(ps.geom)::numeric, 4) as latitude,
  round(extensions.st_x(ps.geom)::numeric, 4) as longitude,
  ga.name as ei_area,
  ga.metadata ->> 'official_operator_name' as ei_operator,
  ga.external_id as concession_id,
  go.name as project_operator,
  case
    when ps.geom is null then 'No primary site coordinate'
    when ga.id is null then 'No official Ei local-network area covers this site'
    when go.name is null then 'Official area found; project has no operator assignment'
    when go.name is not distinct from (ga.metadata ->> 'official_operator_name')
      then 'Aligned'
    else 'Operator assignment differs from official local-area context — review required'
  end as match_status
from public.projects as p
inner join public.project_sites as ps
  on ps.project_id = p.id
 and ps.is_primary
left join public.grid_operators as go
  on go.id = p.grid_operator_id
left join lateral (
  select area.*
  from private.ei_local_network_areas_covering_geom(ps.geom) as area
  limit 1
) as ga on true
order by p.name;
`);

  console.log("\n========== Ei lokalnät ingest ==========");
  console.log(`Ei source identified: ${source.name}`);
  console.log(`Slug: ${source.slug}`);
  console.log(`Publisher: ${source.publisher}`);
  console.log(`Authority: ${source.authority_level}`);
  console.log(`Data type: Network area concession geography`);
  console.log(`Official landing URL: ${LANDING_URL}`);
  console.log(`Distribution: official ZIP discovered from landing page`);
  console.log(`Download URL: ${downloadUrl}`);
  console.log(`Source update/publication date: ${parsed.publishedDate ?? "(not exposed)"}`);
  console.log(`Content hash: ${contentHash}`);
  console.log(`Snapshot ID: ${snapshotId}`);
  console.log(`Snapshot status: ${snapshotStatus}`);
  console.log(`Feature count retrieved (DBF): ${parsed.dbf.recordCount}`);
  console.log(`Unique local-network areas prepared: ${areas.length}`);
  if (mergedExtraParts > 0) {
    console.log(
      `Merged extra polygon parts with the same KONCESSION: ${mergedExtraParts}`,
    );
  }
  console.log(`Areas inserted: ${insertedCount}`);
  console.log(`Areas updated: ${updatedCount}`);
  console.log(`Areas unchanged: ${unchangedCount}`);
  console.log(`Invalid/skipped features: ${skipped}`);
  if (Object.keys(skipReasons).length > 0) {
    for (const [reason, count] of Object.entries(skipReasons)) {
      console.log(`  - ${reason}: ${count}`);
    }
  }
  console.log(`CRS transformation: ${SOURCE_CRS_LABEL} → ${TARGET_CRS} via PostGIS ST_Transform`);
  console.log(`Stored Ei local_network polygons: ${storedAreas.count} (${storedAreas.valid} valid)`);
  console.log(`external_changes for this source: ${changeCount.count} (baseline import creates none)`);
  console.log(`NOXHEIM retrieved: ${existingSnapshot[0]?.retrieved_at ?? retrievedAt}`);

  console.log("\n========== Project → Ei local network area ==========");
  console.log(
    `${pad("Project", 24)}${pad("Lat", 10)}${pad("Lng", 10)}${pad("Ei local network area", 42)}${pad("Official Ei operator", 34)}${pad("Concession", 12)}${pad("Project operator", 28)}Match status`,
  );
  for (const row of matches) {
    console.log(
      `${pad(row.project, 24)}${pad(row.latitude, 10)}${pad(row.longitude, 10)}${pad(row.ei_area, 42)}${pad(row.ei_operator, 34)}${pad(row.concession_id, 12)}${pad(row.project_operator, 28)}${row.match_status}`,
    );
  }

  console.log("\nSemantics: this is official network-area concession geography.");
  console.log("It does not prove capacity, connection availability, or time-to-power.");
  console.log("Customer project rows were not modified.");
}

try {
  await main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
