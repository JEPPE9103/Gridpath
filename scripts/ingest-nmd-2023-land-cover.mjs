/**
 * Ingest Naturvårdsverket NMD 2023 basskikt v0.3 as:
 * - discovery 1 km majority-class polygons (official_physical_summaries)
 * - precision 100 m composition tiles (official_precision_summaries)
 *
 * Publisher: Naturvårdsverket
 * Product: NMD2023 basskikt v0.3
 * Licence: CC0
 * Attribution preferred: “NMD2023 v0.3, Naturvårdsverket”
 * Raster: 10 m, EPSG:3006. Nationwide zip is ~1.3 GB — never commit it.
 *
 * Production path: operator-supplied GeoTIFF via --tif= or NOXHEIM_NMD2023_TIF.
 * Optional --download fetches the official zip (large). Optional --bbox=w,s,e,n
 * windows the raster in EPSG:4326.
 *
 * Usage:
 *   node scripts/ingest-nmd-2023-land-cover.mjs --tif=C:/data/NMD2023bas_v0_3.tif --bbox=14.9,59.1,15.4,59.4
 */
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fromArrayBuffer } from "geotiff";
import { extractZipBytes } from "./lib/extract-zip.mjs";
import { queryIngestSql, resolveIngestTarget } from "./lib/ingest-target.mjs";
import {
  beginIngestionRun,
  classifyIngestError,
  completeIngestionRun,
  ingestTriggerType,
} from "./lib/ingestion-runs.mjs";
import { fetchOpenGeodataBytes } from "./lib/open-geodata-fetch.mjs";

const SLUG = "nv-nmd-2023";
const LISTING = "https://geodata.naturvardsverket.se/nedladdning/marktacke/NMD2023/Basskikt_v0_x/";
const ZIP_NAME = "NMD2023_basskikt_v0_3.zip";

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
function quoteSqlNullable(value) {
  return value == null || value === "" ? "null" : quoteSql(value);
}

function nmd2023ClassToGroup(code) {
  if (!Number.isFinite(code)) return "unclassified";
  const value = Math.trunc(code);
  if (value === 61 || value === 62 || value === 6 || value === 60) return "water";
  if (value === 3 || value === 30 || value === 31) return "agriculture";
  if (value === 51 || value === 52 || value === 53 || value === 54 || value === 5 || value === 50) return "developed";
  if (value === 41 || value === 42 || value === 4 || value === 40) return "open";
  if (value === 43) return "forest";
  if (value === 2 || value === 20 || value === 200 || value === 23) return "wetland";
  if (value >= 21 && value <= 28) return "wetland";
  if (value === 11 || value === 12 || value === 110 || value === 120 || value === 118 || value === 128) return "forest";
  if (value >= 111 && value <= 117) return "forest";
  if (value >= 121 && value <= 127) return "forest";
  return "unclassified";
}

function parseBbox(argv) {
  const raw = argv.find((item) => item.startsWith("--bbox="))?.slice("--bbox=".length) || process.env.NOXHEIM_SCREENING_INGEST_BBOX;
  if (!raw) return null;
  const [west, south, east, north] = raw.split(",").map(Number);
  if (![west, south, east, north].every(Number.isFinite)) throw new Error("Provide --bbox=west,south,east,north.");
  return { west, south, east, north };
}

function parseTif(argv) {
  return argv.find((item) => item.startsWith("--tif="))?.slice("--tif=".length) || process.env.NOXHEIM_NMD2023_TIF || "";
}

function summarise(samples, width, height, originX, originY, cellW, cellH, prefix) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const code = Number(samples[y * width + x]);
      if (!Number.isFinite(code) || code <= 0) continue;
      const xmin = originX + x * cellW;
      const ymax = originY - y * cellH;
      rows.push({
        externalId: `${prefix}:${x}:${y}`,
        xmin,
        ymin: ymax - cellH,
        xmax: xmin + cellW,
        ymax,
        nmdClass: Math.trunc(code),
        group: nmd2023ClassToGroup(code),
      });
    }
  }
  return rows;
}

const argv = process.argv.slice(2);
const bbox = parseBbox(argv);
const download = argv.includes("--download");
let tifPath = parseTif(argv);
const ingestTarget = resolveIngestTarget();
const query = (sql) => queryIngestSql(ingestTarget, sql);
let ingestionRunId = null;
let tmpDir = null;

try {
  query(`
insert into public.grid_sources (
  name, slug, source_type, publisher, base_url, country_code, active, authority_level, update_frequency, refresh_interval_hours
) values (
  'Naturvårdsverket — NMD 2023 basskikt v0.3',
  ${quoteSql(SLUG)},
  'gis',
  'Naturvårdsverket',
  ${quoteSql(LISTING)},
  'SE',
  true,
  'official',
  'as_published',
  8760
)
on conflict (slug) do update set name = excluded.name, active = true;
`);
  const begun = beginIngestionRun(query, quoteSql, { slug: SLUG, trigger: ingestTriggerType() });
  if (begun?.outcome === "skipped_locked" || begun?.outcome === "skipped_not_due") {
    console.log(JSON.stringify({ event: "ingest.nmd2023.skipped", reason: begun.outcome }));
    process.exit(0);
  }
  ingestionRunId = begun.run_id;

  if (!tifPath && download) {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "noxheim-nmd2023-"));
    const zipBytes = await fetchOpenGeodataBytes(`${LISTING}${ZIP_NAME}`, { timeoutMs: 600_000 });
    extractZipBytes(zipBytes, tmpDir);
    const { readdirSync } = await import("node:fs");
    const tifName = readdirSync(tmpDir).find((name) => name.toLowerCase().endsWith(".tif"));
    if (!tifName) throw new Error("NMD 2023 zip did not contain a GeoTIFF.");
    tifPath = path.join(tmpDir, tifName);
  }
  if (!tifPath || !existsSync(tifPath)) {
    completeIngestionRun(query, quoteSql, quoteSqlNullable, {
      runId: ingestionRunId,
      status: "skipped",
      snapshotId: null,
      sourceChanged: false,
      observationsProcessed: 0,
      externalChangesCreated: 0,
      impactsCreated: 0,
      errorCode: "tif_not_configured",
      errorMessage:
        "NMD 2023 GeoTIFF not configured. Set --tif= or NOXHEIM_NMD2023_TIF (do not commit the raster).",
      metadata: { probe_only: true },
    });
    console.log(JSON.stringify({ event: "ingest.nmd2023.skipped", reason: "tif_not_configured" }));
    process.exit(0);
  }

  const tifBytes = readFileSync(tifPath);
  const tiff = await fromArrayBuffer(tifBytes.buffer.slice(tifBytes.byteOffset, tifBytes.byteOffset + tifBytes.byteLength));
  const image = await tiff.getImage();
  const fullWidth = image.getWidth();
  const fullHeight = image.getHeight();
  const [originX, originY] = image.getOrigin();
  const [resX, resY] = image.getResolution();

  const discoveryWidth = Math.max(1, Math.round(fullWidth / 100));
  const discoveryHeight = Math.max(1, Math.round(fullHeight / 100));
  const wantPrecision = Boolean(bbox) && discoveryWidth * discoveryHeight < 80_000;
  const precisionWidth = wantPrecision ? Math.max(1, Math.round(fullWidth / 10)) : 0;
  const precisionHeight = wantPrecision ? Math.max(1, Math.round(fullHeight / 10)) : 0;
  const discoveryRasters = await image.readRasters({ width: discoveryWidth, height: discoveryHeight, resampleMethod: "nearest" });
  const precisionRasters = wantPrecision
    ? await image.readRasters({ width: precisionWidth, height: precisionHeight, resampleMethod: "nearest" })
    : null;

  const discovery = summarise(
    discoveryRasters[0],
    discoveryWidth,
    discoveryHeight,
    originX,
    originY,
    Math.abs(resX) * (fullWidth / discoveryWidth),
    Math.abs(resY) * (fullHeight / discoveryHeight),
    "nmd2023:1km",
  );
  const precision = precisionRasters
    ? summarise(
        precisionRasters[0],
        precisionWidth,
        precisionHeight,
        originX,
        originY,
        Math.abs(resX) * (fullWidth / precisionWidth),
        Math.abs(resY) * (fullHeight / precisionHeight),
        "nmd2023:100m",
      )
    : [];

  const retrievedAt = new Date().toISOString();
  const hash = createHash("sha256").update(`${SLUG}|${discovery.length}|${precision.length}`).digest("hex");
  const source = query(`select id from public.grid_sources where slug = ${quoteSql(SLUG)};`)[0];
  const inserted = query(`
insert into public.source_snapshots (
  source_id, retrieved_at, published_at, content_hash, raw_content, storage_path, status, metadata
) values (
  ${quoteSql(source.id)}::uuid,
  ${quoteSql(retrievedAt)}::timestamptz,
  null,
  ${quoteSql(hash)},
  null,
  null,
  'success',
  ${quoteSql(JSON.stringify({
    publisher: "Naturvårdsverket",
    dataset: "NMD2023 basskikt v0.3",
    license: "CC0",
    attribution: "NMD2023 v0.3, Naturvårdsverket",
    mapping_version: "nmd-group-v2",
    bbox,
    discovery_count: discovery.length,
    precision_count: precision.length,
  }))}::jsonb
)
returning id;
`);
  const snapshotId = inserted[0].id;

  if (bbox) {
    query(`
delete from public.official_physical_summaries as s
using public.grid_sources as gs
where s.source_id = gs.id
  and gs.slug = 'nv-nmd-2018'
  and s.summary_class = 'land_cover'
  and s.geom && extensions.st_setsrid(extensions.st_makeenvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}), 4326);
`);
  }

  const BATCH = 25;
  let processed = 0;
  for (let i = 0; i < discovery.length; i += BATCH) {
    const chunk = discovery.slice(i, i + BATCH);
    const values = chunk.map(
      (row) => `(
        ${quoteSql(source.id)}::uuid,
        ${quoteSql(snapshotId)}::uuid,
        'land_cover',
        ${quoteSql(row.externalId)},
        extensions.st_transform(extensions.st_setsrid(extensions.st_makeenvelope(${row.xmin}, ${row.ymin}, ${row.xmax}, ${row.ymax}), 3006), 4326),
        ${row.nmdClass},
        ${quoteSql(row.group)},
        1000,
        'nmd_2023_v0',
        ${quoteSql(retrievedAt)}::timestamptz
      )`,
    );
    query(`
insert into public.official_physical_summaries (
  source_id, snapshot_id, summary_class, external_id, geom, nmd_class, land_cover_group, resolution_m, taxonomy, fetched_at
) values
${values.join(",\n")}
on conflict (source_id, external_id) do update
set snapshot_id = excluded.snapshot_id, geom = excluded.geom, nmd_class = excluded.nmd_class,
    land_cover_group = excluded.land_cover_group, resolution_m = excluded.resolution_m,
    taxonomy = excluded.taxonomy, fetched_at = excluded.fetched_at, updated_at = now();
`);
    processed += chunk.length;
  }

  let precisionCount = 0;
  for (let i = 0; i < precision.length; i += BATCH) {
    const chunk = precision.slice(i, i + BATCH);
    const values = chunk.map(
      (row) => `(
        ${quoteSql(source.id)}::uuid,
        ${quoteSql(snapshotId)}::uuid,
        'land_cover',
        'nmd_2023_v0',
        100,
        ${quoteSql(row.externalId)},
        extensions.st_transform(extensions.st_setsrid(extensions.st_makeenvelope(${row.xmin}, ${row.ymin}, ${row.xmax}, ${row.ymax}), 3006), 4326),
        ${row.nmdClass},
        ${quoteSql(row.group)}
      )`,
    );
    query(`
insert into public.official_precision_summaries (
  source_id, snapshot_id, summary_class, taxonomy, resolution_m, external_id, geom, nmd_class, land_cover_group
) values
${values.join(",\n")}
on conflict (source_id, external_id) do update
set snapshot_id = excluded.snapshot_id, geom = excluded.geom, nmd_class = excluded.nmd_class,
    land_cover_group = excluded.land_cover_group, taxonomy = excluded.taxonomy, resolution_m = excluded.resolution_m;
`);
    precisionCount += chunk.length;
  }

  try {
    query(`select public.flag_opportunity_reassessment(${quoteSql(SLUG)}, ${quoteSql("New official land-cover source version is available for this opportunity.")});`);
  } catch {
    // notices table may not exist on older DBs
  }

  completeIngestionRun(query, quoteSql, quoteSqlNullable, {
    runId: ingestionRunId,
    status: "success",
    snapshotId,
    sourceChanged: true,
    observationsProcessed: processed + precisionCount,
    externalChangesCreated: 0,
    impactsCreated: 0,
    errorCode: null,
    errorMessage: null,
    metadata: { discovery: processed, precision: precisionCount, license: "CC0", probe_only: false },
  });
  console.log(JSON.stringify({ event: "ingest.nmd2023.complete", discovery: processed, precision: precisionCount, bbox }));
} catch (error) {
  if (ingestionRunId) {
    try {
      completeIngestionRun(query, quoteSql, quoteSqlNullable, {
        runId: ingestionRunId,
        status: "failed",
        snapshotId: null,
        sourceChanged: null,
        observationsProcessed: null,
        externalChangesCreated: null,
        impactsCreated: null,
        errorCode: classifyIngestError(error),
        errorMessage: error instanceof Error ? error.message : "failed",
        metadata: { dataset: SLUG },
      });
    } catch {
      // ignore
    }
  }
  throw error;
} finally {
  if (tmpDir) {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
