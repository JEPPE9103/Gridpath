/**
 * Ingest Copernicus DEM GLO-90 tiles into 1 km slope summaries.
 *
 * Publisher: European Union / Copernicus
 * Dataset: Copernicus DEM GLO-90 (AWS public COG)
 * Licence: Copernicus WorldDEM-30 / free and open with attribution
 * CRS of source: WGS84 geographic; stored summaries EPSG:4326
 * Product: DSM (includes vegetation and buildings), not a DTM.
 * Not Lantmäteriet Grid 50+.
 *
 * Usage: node scripts/ingest-copernicus-dem-slope.mjs --bbox=14.9,59.1,15.4,59.4
 * Rasters are never committed to git.
 */
import { createHash } from "node:crypto";
import { fromArrayBuffer } from "geotiff";
import { queryIngestSql, resolveIngestTarget } from "./lib/ingest-target.mjs";
import {
  beginIngestionRun,
  classifyIngestError,
  completeIngestionRun,
  ingestTriggerType,
} from "./lib/ingestion-runs.mjs";
import { fetchOpenGeodataBytes } from "./lib/open-geodata-fetch.mjs";

const SLUG = "copernicus-dem-glo90";
const SOURCE_NAME = "Copernicus DEM GLO-90 (derived 1 km slope summaries)";

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function quoteSqlNullable(value) {
  return value == null || value === "" ? "null" : quoteSql(value);
}

function parseBbox(argv) {
  const raw =
    argv.find((item) => item.startsWith("--bbox="))?.slice("--bbox=".length) ||
    process.env.NOXHEIM_SCREENING_INGEST_BBOX ||
    "14.9,59.1,15.4,59.4";
  const [west, south, east, north] = raw.split(",").map(Number);
  if (![west, south, east, north].every(Number.isFinite) || west >= east || south >= north) {
    throw new Error("Provide --bbox=west,south,east,north with west<east and south<north.");
  }
  return { west, south, east, north };
}

function tileName(lat, lon) {
  const n = String(Math.abs(lat)).padStart(2, "0");
  const e = String(Math.abs(lon)).padStart(3, "0");
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `Copernicus_DSM_COG_30_${ns}${n}_00_${ew}${e}_00_DEM`;
}

function tileUrl(lat, lon) {
  const name = tileName(lat, lon);
  return `https://copernicus-dem-90m.s3.amazonaws.com/${name}/${name}.tif`;
}

function hornSlopeDeg(z, width, height, x, y, dx, dy) {
  const at = (col, row) => z[row * width + col];
  const dzdx =
    (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1))) /
    (8 * dx);
  const dzdy =
    (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1))) /
    (8 * dy);
  return (Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180) / Math.PI;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (1 - (index - lower)) + sorted[upper] * (index - lower);
}

async function summariesFromTile(bytes, bbox) {
  const tiff = await fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  const z = rasters[0];
  const width = image.getWidth();
  const height = image.getHeight();
  const [originX, originY] = image.getOrigin();
  const [resX, resY] = image.getResolution();
  const bins = new Map();
  const lat0 = originY;
  const lon0 = originX;
  for (let y = 1; y < height - 1; y += 4) {
    for (let x = 1; x < width - 1; x += 4) {
      const lon = lon0 + x * resX;
      const lat = lat0 + y * resY;
      if (lon < bbox.west || lon > bbox.east || lat < bbox.south || lat > bbox.north) continue;
      const elev = z[y * width + x];
      if (!Number.isFinite(elev) || elev < -100) continue;
      const metersPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
      const slope = hornSlopeDeg(z, width, height, x, y, Math.abs(resX) * metersPerDegLon, Math.abs(resY) * 110540);
      if (!Number.isFinite(slope)) continue;
      const key = `${Math.floor(lat * 100) / 100}:${Math.floor(lon * 100) / 100}`;
      const bin = bins.get(key) ?? [];
      bin.push(slope);
      bins.set(key, bin);
    }
  }
  const rows = [];
  for (const [key, values] of bins) {
    if (values.length < 4) continue;
    const sorted = values.slice().sort((a, b) => a - b);
    const [latStr, lonStr] = key.split(":");
    const south = Number(latStr);
    const west = Number(lonStr);
    const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
    rows.push({
      externalId: `glo90:${key}`,
      west,
      south,
      east: west + 0.01,
      north: south + 0.01,
      mean,
      median: percentile(sorted, 0.5),
      p90: percentile(sorted, 0.9),
      max: sorted[sorted.length - 1],
      pctLe5: (sorted.filter((value) => value <= 5).length / sorted.length) * 100,
      pctLe8: (sorted.filter((value) => value <= 8).length / sorted.length) * 100,
      pctLe12: (sorted.filter((value) => value <= 12).length / sorted.length) * 100,
    });
  }
  return rows;
}

function upsertSql(sourceId, snapshotId, rows, fetchedAt) {
  if (!rows.length) return null;
  const values = rows.map(
    (row) => `(
      ${quoteSql(sourceId)}::uuid,
      ${quoteSql(snapshotId)}::uuid,
      'terrain',
      ${quoteSql(row.externalId)},
      extensions.st_setsrid(extensions.st_makeenvelope(${row.west}, ${row.south}, ${row.east}, ${row.north}), 4326),
      ${row.mean},
      ${row.median},
      ${row.p90},
      ${row.max},
      ${row.pctLe5},
      ${row.pctLe8},
      ${row.pctLe12},
      ${quoteSql(fetchedAt)}::timestamptz
    )`,
  );
  return `
insert into public.official_physical_summaries (
  source_id, snapshot_id, summary_class, external_id, geom,
  mean_slope_deg, median_slope_deg, p90_slope_deg, max_slope_deg,
  pct_le_5, pct_le_8, pct_le_12, fetched_at
) values
${values.join(",\n")}
on conflict (source_id, external_id) do update
set
  snapshot_id = excluded.snapshot_id,
  geom = excluded.geom,
  mean_slope_deg = excluded.mean_slope_deg,
  median_slope_deg = excluded.median_slope_deg,
  p90_slope_deg = excluded.p90_slope_deg,
  max_slope_deg = excluded.max_slope_deg,
  pct_le_5 = excluded.pct_le_5,
  pct_le_8 = excluded.pct_le_8,
  pct_le_12 = excluded.pct_le_12,
  fetched_at = excluded.fetched_at,
  updated_at = now();
`;
}

const bbox = parseBbox(process.argv.slice(2));
const ingestTarget = resolveIngestTarget();
const query = (sql) => queryIngestSql(ingestTarget, sql);
let ingestionRunId = null;

try {
  query(`
insert into public.grid_sources (
  name, slug, source_type, publisher, base_url, country_code, active, authority_level, update_frequency, refresh_interval_hours
) values (
  ${quoteSql(SOURCE_NAME)},
  ${quoteSql(SLUG)},
  'gis',
  'European Union / Copernicus',
  'https://copernicus-dem-90m.s3.amazonaws.com',
  'SE',
  true,
  'official',
  'as_published',
  8760
)
on conflict (slug) do update
set name = excluded.name, publisher = excluded.publisher, active = true;
`);
  const begun = beginIngestionRun(query, quoteSql, { slug: SLUG, trigger: ingestTriggerType() });
  if (begun?.outcome === "skipped_locked" || begun?.outcome === "skipped_not_due") {
    console.log(JSON.stringify({ event: "ingest.copernicus.skipped", reason: begun.outcome }));
    process.exit(0);
  }
  ingestionRunId = begun.run_id;
  const retrievedAt = new Date().toISOString();
  const allRows = [];
  for (let lat = Math.floor(bbox.south); lat <= Math.floor(bbox.north); lat += 1) {
    for (let lon = Math.floor(bbox.west); lon <= Math.floor(bbox.east); lon += 1) {
      const url = tileUrl(lat, lon);
      try {
        const bytes = await fetchOpenGeodataBytes(url);
        const rows = await summariesFromTile(bytes, bbox);
        allRows.push(...rows);
        console.log(JSON.stringify({ event: "ingest.copernicus.tile", url: new URL(url).pathname, rows: rows.length }));
      } catch (error) {
        console.error(JSON.stringify({ event: "ingest.copernicus.tile_failed", lat, lon, message: error instanceof Error ? error.message : "failed" }));
      }
    }
  }
  const hash = createHash("sha256").update(`${SLUG}|${bbox.west}|${bbox.south}|${bbox.east}|${bbox.north}|${allRows.length}`).digest("hex");
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
    publisher: "European Union / Copernicus",
    dataset: "Copernicus DEM GLO-90",
    license: "Copernicus WorldDEM-30 — free and open with attribution",
    attribution: "Copernicus DEM, European Union",
    product: "DSM 90 m",
    crs: "EPSG:4326",
    bbox,
    summary_count: allRows.length,
    commercial_use: "permitted under Copernicus DEM licence; not Lantmäteriet Grid 50+",
  }))}::jsonb
)
returning id;
`);
  const snapshotId = inserted[0].id;
  const BATCH = 40;
  let processed = 0;
  for (let i = 0; i < allRows.length; i += BATCH) {
    const sql = upsertSql(source.id, snapshotId, allRows.slice(i, i + BATCH), retrievedAt);
    if (!sql) continue;
    query(sql);
    processed += Math.min(BATCH, allRows.length - i);
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
    metadata: { bbox, summary_count: processed, probe_only: false },
  });
  console.log(JSON.stringify({ event: "ingest.copernicus.complete", summaries: processed, bbox }));
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
}
