/**
 * Ingest Naturvårdsverket NMD 2023 basskikt v0.3 as:
 * - discovery 1 km majority-class polygons (official_physical_summaries)
 * - precision composition tiles (official_precision_summaries), majority-class
 *   from native 10 m cells, targeting 50 m inside a bbox (never labelled as 10 m)
 *
 * Publisher: Naturvårdsverket
 * Product: NMD2023 basskikt v0.3
 * Licence: CC0
 * Attribution preferred: “NMD2023 v0.3, Naturvårdsverket”
 * Raster: 10 m, EPSG:3006. Nationwide zip is ~1.3 GB — never commit it.
 *
 * Production path: one-time national GeoTIFF outside Git via --tif=,
 * NOXHEIM_NMD2023_TIF, NOXHEIM_GEODATA_CACHE, or ~/noxheim-geodata.
 * Optional --download fetches the official zip once (large). Optional
 * --bbox=w,s,e,n windows the raster. Never redownload 1.3+ GB per search.
 *
 * Usage:
 *   node scripts/ingest-nmd-2023-land-cover.mjs --tif=C:/data/NMD2023bas_v0_3.tif --bbox=14.9,59.1,15.4,59.4
 */
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fromFile } from "geotiff";
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

function geodataCacheRoot() {
  return process.env.NOXHEIM_GEODATA_CACHE || path.join(os.homedir(), "noxheim-geodata");
}

function resolveNmd2023Tif(argv) {
  const explicit = parseTif(argv);
  if (explicit && existsSync(explicit)) return explicit;
  const cacheRoot = geodataCacheRoot();
  const names = [
    "NMD2023bas_v0_3.tif",
    "NMD2023_basskikt_v0_3.tif",
    "NMD2023bas_v03.tif",
    path.join("NMD2023_basskikt_v0_3", "NMD2023bas_v0_3.tif"),
  ];
  for (const name of names) {
    const candidate = path.join(cacheRoot, name);
    if (existsSync(candidate)) return candidate;
  }
  return explicit;
}

function bboxTo3006(query, bbox) {
  const row = query(`
    select
      extensions.st_xmin(g) as xmin,
      extensions.st_ymin(g) as ymin,
      extensions.st_xmax(g) as xmax,
      extensions.st_ymax(g) as ymax
    from (
      select extensions.st_transform(
        extensions.st_setsrid(
          extensions.st_makeenvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}),
          4326
        ),
        3006
      ) as g
    ) as transformed;
  `)[0];
  return {
    xmin: Number(row.xmin),
    ymin: Number(row.ymin),
    xmax: Number(row.xmax),
    ymax: Number(row.ymax),
  };
}

function pixelWindow(originX, originY, resX, resY, width, height, extent) {
  const col0 = Math.floor((extent.xmin - originX) / resX);
  const col1 = Math.ceil((extent.xmax - originX) / resX);
  const row0 = Math.floor((extent.ymax - originY) / resY);
  const row1 = Math.ceil((extent.ymin - originY) / resY);
  const left = Math.max(0, Math.min(width, Math.min(col0, col1)));
  const right = Math.max(0, Math.min(width, Math.max(col0, col1)));
  const top = Math.max(0, Math.min(height, Math.min(row0, row1)));
  const bottom = Math.max(0, Math.min(height, Math.max(row0, row1)));
  return { left, top, right, bottom };
}

function processingFactor(nativeM, windowWidth, windowHeight, maxCells, targetM, maxM) {
  let factor = Math.max(1, Math.round(targetM / nativeM));
  const cap = Math.max(factor, Math.round(maxM / nativeM));
  while ((windowWidth / factor) * (windowHeight / factor) > maxCells && factor < cap) {
    factor += 1;
  }
  while ((windowWidth / factor) * (windowHeight / factor) > maxCells) {
    factor += 1;
  }
  return factor;
}

function majorityResample(samples, srcW, srcH, factor) {
  const outW = Math.max(1, Math.floor(srcW / factor));
  const outH = Math.max(1, Math.floor(srcH / factor));
  const out = new Float64Array(outW * outH);
  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const counts = new Map();
      let best = 0;
      let bestN = -1;
      for (let dy = 0; dy < factor; dy += 1) {
        const sy = y * factor + dy;
        if (sy >= srcH) continue;
        for (let dx = 0; dx < factor; dx += 1) {
          const sx = x * factor + dx;
          if (sx >= srcW) continue;
          const code = Number(samples[sy * srcW + sx]);
          if (!Number.isFinite(code) || code <= 0) continue;
          const n = (counts.get(code) ?? 0) + 1;
          counts.set(code, n);
          if (n > bestN) {
            bestN = n;
            best = code;
          }
        }
      }
      out[y * outW + x] = best;
    }
  }
  return { samples: out, width: outW, height: outH };
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
let tifPath = resolveNmd2023Tif(argv);
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
    const zipBytes = await fetchOpenGeodataBytes(`${LISTING}${ZIP_NAME}`, { timeoutMs: 1_200_000 });
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
        "NMD 2023 GeoTIFF not configured. Place the national raster once outside Git (NOXHEIM_NMD2023_TIF, or NOXHEIM_GEODATA_CACHE / ~/noxheim-geodata) and pass --bbox= for AOI extract. Do not redownload the 1.3+ GB archive per search. Optional --download fetches it once.",
      metadata: { probe_only: true },
    });
    console.log(JSON.stringify({ event: "ingest.nmd2023.skipped", reason: "tif_not_configured" }));
    process.exit(0);
  }

  const tiff = await fromFile(tifPath);
  const image = await tiff.getImage();
  const fullWidth = image.getWidth();
  const fullHeight = image.getHeight();
  const [originX, originY] = image.getOrigin();
  const [resX, resY] = image.getResolution();
  const nativeM = Math.abs(resX);
  const SOURCE_RESOLUTION_M = 10;

  let window = { left: 0, top: 0, right: fullWidth, bottom: fullHeight };
  if (bbox) {
    window = pixelWindow(originX, originY, resX, resY, fullWidth, fullHeight, bboxTo3006(query, bbox));
  }
  const winW = Math.max(1, window.right - window.left);
  const winH = Math.max(1, window.bottom - window.top);
  const winOriginX = originX + window.left * resX;
  const winOriginY = originY + window.top * resY;

  const discoveryFactor = Math.max(1, Math.round(1000 / nativeM));
  const precisionFactor = bbox
    ? processingFactor(nativeM, winW, winH, 400_000, 50, 100)
    : processingFactor(nativeM, winW, winH, 80_000, 100, 100);
  const processingM = Math.round(nativeM * precisionFactor);
  const wantPrecision = Boolean(bbox);
  const nativeCellCount = winW * winH;
  const rasterOpts = { window: [window.left, window.top, window.right, window.bottom], resampleMethod: "nearest" };

  let discoverySamples;
  let discoveryWidth;
  let discoveryHeight;
  let precisionSamples = null;
  let precisionWidth = 0;
  let precisionHeight = 0;

  if (bbox && nativeCellCount <= 12_000_000) {
    const nativeRasters = await image.readRasters(rasterOpts);
    const nativeSamples = nativeRasters[0];
    const discoveryAgg = majorityResample(nativeSamples, winW, winH, discoveryFactor);
    discoverySamples = discoveryAgg.samples;
    discoveryWidth = discoveryAgg.width;
    discoveryHeight = discoveryAgg.height;
    if (wantPrecision) {
      const precisionAgg = majorityResample(nativeSamples, winW, winH, precisionFactor);
      precisionSamples = precisionAgg.samples;
      precisionWidth = precisionAgg.width;
      precisionHeight = precisionAgg.height;
    }
  } else {
    discoveryWidth = Math.max(1, Math.round(winW / discoveryFactor));
    discoveryHeight = Math.max(1, Math.round(winH / discoveryFactor));
    const discoveryRasters = await image.readRasters({
      ...rasterOpts,
      width: discoveryWidth,
      height: discoveryHeight,
    });
    discoverySamples = discoveryRasters[0];
    if (wantPrecision) {
      precisionWidth = Math.max(1, Math.round(winW / precisionFactor));
      precisionHeight = Math.max(1, Math.round(winH / precisionFactor));
      const precisionRasters = await image.readRasters({
        ...rasterOpts,
        width: precisionWidth,
        height: precisionHeight,
      });
      precisionSamples = precisionRasters[0];
    }
  }

  const discovery = summarise(
    discoverySamples,
    discoveryWidth,
    discoveryHeight,
    winOriginX,
    winOriginY,
    Math.abs(resX) * (winW / discoveryWidth),
    Math.abs(resY) * (winH / discoveryHeight),
    "nmd2023:1km",
  );
  const precision = precisionSamples
    ? summarise(
        precisionSamples,
        precisionWidth,
        precisionHeight,
        winOriginX,
        winOriginY,
        Math.abs(resX) * (winW / precisionWidth),
        Math.abs(resY) * (winH / precisionHeight),
        `nmd2023:${processingM}m`,
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
    source_resolution_m: SOURCE_RESOLUTION_M,
    discovery_processing_resolution_m: 1000,
    precision_processing_resolution_m: processingM,
    precision_aggregation: nativeCellCount <= 12_000_000 && bbox ? "majority_from_10m" : "geotiff_nearest_resample",
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

  const BATCH = 100;
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
        ${processingM},
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
