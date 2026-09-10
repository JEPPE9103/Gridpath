/**
 * Ingest Naturvårdsverket NMD 2018 basskikt as 1 km majority-class polygons.
 *
 * Publisher: Naturvårdsverket
 * Dataset: Nationella marktäckedata 2018 basskikt, ogeneraliserad
 * Licence: CC0
 * Attribution preferred: “NMD, Naturvårdsverket”
 * Raster: 10 m, EPSG:3006. Stored summaries: EPSG:4326 polygons via PostGIS transform.
 *
 * Usage: node scripts/ingest-nmd-land-cover.mjs --county=T
 * Never commit county GeoTIFFs to git.
 */
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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
import { fetchOpenGeodataBytes, fetchOpenGeodataText } from "./lib/open-geodata-fetch.mjs";

const SLUG = "nv-nmd-2018";
const LISTING = "https://geodata.naturvardsverket.se/nedladdning/marktacke/nmd2018/bas_lan_ogen/";

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
function quoteSqlNullable(value) {
  return value == null || value === "" ? "null" : quoteSql(value);
}

function nmdClassToGroup(code) {
  if (!Number.isFinite(code)) return "unclassified";
  const value = Math.trunc(code);
  if (value === 2 || value === 3) return "water";
  if (value >= 41 && value <= 47) return "forest";
  if (value >= 51 && value <= 55) return "forest";
  if (value === 61) return "open";
  if (value === 62 || value === 71) return "wetland";
  if (value === 81) return "agriculture";
  if (value === 82 || value === 83) return "open";
  if (value >= 84 && value <= 86) return "developed";
  return "unclassified";
}

function parseCounty(argv) {
  return (
    argv.find((item) => item.startsWith("--county="))?.slice("--county=".length) ||
    process.env.NOXHEIM_NMD_COUNTY ||
    "T"
  ).toUpperCase();
}

async function resolveCountyZip(county) {
  const listing = await fetchOpenGeodataText(LISTING);
  const match = listing.match(new RegExp(`${county}_lan_nmd2018bas_ogeneraliserad_v1_1\\.zip`, "i"));
  if (!match) throw new Error(`No NMD 2018 zip listed for county ${county}.`);
  return `${LISTING}${match[0]}`;
}

const county = parseCounty(process.argv.slice(2));
const ingestTarget = resolveIngestTarget();
const query = (sql) => queryIngestSql(ingestTarget, sql);
let ingestionRunId = null;
let tmpDir = null;

try {
  query(`
insert into public.grid_sources (
  name, slug, source_type, publisher, base_url, country_code, active, authority_level, update_frequency, refresh_interval_hours
) values (
  'Naturvårdsverket — NMD 2018 basskikt (1 km majority class)',
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
    console.log(JSON.stringify({ event: "ingest.nmd.skipped", reason: begun.outcome }));
    process.exit(0);
  }
  ingestionRunId = begun.run_id;
  const zipUrl = await resolveCountyZip(county);
  const zipBytes = await fetchOpenGeodataBytes(zipUrl, { timeoutMs: 300_000 });
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "noxheim-nmd-"));
  extractZipBytes(zipBytes, tmpDir);
  const { readdirSync, statSync } = await import("node:fs");
  function findTif(dir) {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        const nested = findTif(full);
        if (nested) return nested;
      } else if (name.toLowerCase().endsWith(".tif")) {
        return full;
      }
    }
    return null;
  }
  const tifPath = findTif(tmpDir);
  if (!tifPath) throw new Error("NMD zip did not contain a GeoTIFF.");
  const tifBytes = readFileSync(tifPath);
  const tiff = await fromArrayBuffer(tifBytes.buffer.slice(tifBytes.byteOffset, tifBytes.byteOffset + tifBytes.byteLength));
  const image = await tiff.getImage();
  const fullWidth = image.getWidth();
  const fullHeight = image.getHeight();
  const width = Math.max(1, Math.round(fullWidth / 100));
  const height = Math.max(1, Math.round(fullHeight / 100));
  const rasters = await image.readRasters({ width, height, resampleMethod: "nearest" });
  const samples = rasters[0];
  const [originX, originY] = image.getOrigin();
  const [resX, resY] = image.getResolution();
  const cellW = Math.abs(resX) * (fullWidth / width);
  const cellH = Math.abs(resY) * (fullHeight / height);
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const code = Number(samples[y * width + x]);
      if (!Number.isFinite(code) || code <= 0) continue;
      const xmin = originX + x * cellW;
      const ymax = originY - y * cellH;
      const xmax = xmin + cellW;
      const ymin = ymax - cellH;
      rows.push({
        externalId: `nmd2018:${county}:${x}:${y}`,
        xmin,
        ymin,
        xmax,
        ymax,
        nmdClass: Math.trunc(code),
        group: nmdClassToGroup(code),
      });
    }
  }
  const retrievedAt = new Date().toISOString();
  const hash = createHash("sha256").update(`${SLUG}|${county}|${rows.length}`).digest("hex");
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
    dataset: "NMD 2018 basskikt",
    license: "CC0",
    attribution: "NMD, Naturvårdsverket",
    county,
    crs_source: "EPSG:3006",
    summary_count: rows.length,
    commercial_use: "CC0",
  }))}::jsonb
)
returning id;
`);
  const snapshotId = inserted[0].id;
  const BATCH = 25;
  let processed = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values = chunk.map(
      (row) => `(
        ${quoteSql(source.id)}::uuid,
        ${quoteSql(snapshotId)}::uuid,
        'land_cover',
        ${quoteSql(row.externalId)},
        extensions.st_transform(
          extensions.st_setsrid(extensions.st_makeenvelope(${row.xmin}, ${row.ymin}, ${row.xmax}, ${row.ymax}), 3006),
          4326
        ),
        ${row.nmdClass},
        ${quoteSql(row.group)},
        ${quoteSql(retrievedAt)}::timestamptz
      )`,
    );
    query(`
insert into public.official_physical_summaries (
  source_id, snapshot_id, summary_class, external_id, geom, nmd_class, land_cover_group, fetched_at
) values
${values.join(",\n")}
on conflict (source_id, external_id) do update
set snapshot_id = excluded.snapshot_id, geom = excluded.geom, nmd_class = excluded.nmd_class,
    land_cover_group = excluded.land_cover_group, fetched_at = excluded.fetched_at, updated_at = now();
`);
    processed += chunk.length;
  }
  completeIngestionRun(query, quoteSql, quoteSqlNullable, {
    runId: ingestionRunId,
    status: "success",
    snapshotId,
    sourceChanged: true,
    observationsProcessed: processed,
    externalChangesCreated: 0,
    impactsCreated: 0,
    errorCode: null,
    errorMessage: null,
    metadata: { county, summary_count: processed, license: "CC0", probe_only: false },
  });
  console.log(JSON.stringify({ event: "ingest.nmd.complete", county, summaries: processed }));
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
        metadata: { dataset: SLUG, county },
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
