/**
 * Ingest Trafikverket INSPIRE RoadLink (NVDB) for screening proximity.
 *
 * Publisher: Trafikverket
 * Dataset: INSPIRE Transport Networks — RoadLink
 * Licence: CC0 (NVDB/INSPIRE dataset)
 * WFS: https://geo-inspire.trafikverket.se/MapService/wfs.axd/TN_RoadTransportNetwork
 *
 * The WFS has returned HTTP 400 / ExceptionReport in live proof and is not
 * retried per search. Official Trafikverket geodata is published through
 * Lastkajen; set TRAFIKVERKET_ROADLINK_GPKG when an operator GeoPackage is
 * available. Until then road context stays insufficient evidence.
 *
 * Usage: node scripts/ingest-trafikverket-roads.mjs --bbox=14.9,59.1,15.4,59.4
 */
import { createHash } from "node:crypto";
import { queryIngestSql, resolveIngestTarget } from "./lib/ingest-target.mjs";
import {
  beginIngestionRun,
  classifyIngestError,
  completeIngestionRun,
  ingestTriggerType,
} from "./lib/ingestion-runs.mjs";
import { fetchOpenGeodataText, parseGeoJsonFeatureCollection } from "./lib/open-geodata-fetch.mjs";

const SLUG = "trafikverket-inspire-roadlink";
const WFS = "https://geo-inspire.trafikverket.se/MapService/wfs.axd/TN_RoadTransportNetwork";

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
  if (![west, south, east, north].every(Number.isFinite)) {
    throw new Error("Provide --bbox=west,south,east,north.");
  }
  return { west, south, east, north };
}

function buildUrl(bbox, startIndex, axis) {
  const url = new URL(WFS);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("typeNames", "tn-ro:RoadLink");
  url.searchParams.set("outputFormat", "application/json");
  url.searchParams.set("srsName", "EPSG:4326");
  url.searchParams.set("count", "100");
  if (startIndex > 0) url.searchParams.set("startIndex", String(startIndex));
  if (axis === "latlon") {
    url.searchParams.set("bbox", `${bbox.south},${bbox.west},${bbox.north},${bbox.east},EPSG:4326`);
  } else {
    url.searchParams.set("bbox", `${bbox.west},${bbox.south},${bbox.east},${bbox.north},EPSG:4326`);
  }
  return url.href;
}

function looksLatLon(pair) {
  return (
    Array.isArray(pair) &&
    pair.length >= 2 &&
    Number(pair[0]) > 40 &&
    Number(pair[0]) < 80 &&
    Number(pair[1]) > 0 &&
    Number(pair[1]) < 40
  );
}

function swapLatLonCoords(coords) {
  if (!Array.isArray(coords) || coords.length === 0) return coords;
  if (typeof coords[0] === "number") {
    return looksLatLon(coords) ? [coords[1], coords[0], ...coords.slice(2)] : coords;
  }
  return coords.map(swapLatLonCoords);
}

function normalizeRoadGeometry(geom) {
  return { ...geom, coordinates: swapLatLonCoords(geom.coordinates) };
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
  'Trafikverket — INSPIRE RoadLink (NVDB)',
  ${quoteSql(SLUG)},
  'gis',
  'Trafikverket',
  ${quoteSql(WFS)},
  'SE',
  true,
  'official',
  'as_published',
  168
)
on conflict (slug) do update set name = excluded.name, active = true;
`);
  const begun = beginIngestionRun(query, quoteSql, { slug: SLUG, trigger: ingestTriggerType() });
  if (begun?.outcome === "skipped_locked" || begun?.outcome === "skipped_not_due") {
    console.log(JSON.stringify({ event: "ingest.roads.skipped", reason: begun.outcome }));
    process.exit(0);
  }
  ingestionRunId = begun.run_id;
  const features = [];
  let startIndex = 0;
  let transientFailures = 0;
  let axis = "lonlat";
  const firstLatlon = await fetchOpenGeodataText(buildUrl(bbox, 0, "latlon"), { timeoutMs: 90_000 }).catch(() => "");
  if (firstLatlon && !firstLatlon.includes("ExceptionReport") && parseGeoJsonFeatureCollection(firstLatlon).features.length) {
    axis = "latlon";
    features.push(...parseGeoJsonFeatureCollection(firstLatlon).features);
    startIndex = features.length;
  }
  while (startIndex < 20_000) {
    let text;
    try {
      text = await fetchOpenGeodataText(buildUrl(bbox, startIndex, axis), { timeoutMs: 90_000 });
    } catch (error) {
      transientFailures += 1;
      if (transientFailures > 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * transientFailures));
      continue;
    }
    if (text.includes("ExceptionReport") || text.includes("ows:Exception")) {
      transientFailures += 1;
      if (transientFailures > 1) {
        throw new Error(`Trafikverket WFS ExceptionReport: ${text.slice(0, 240)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1500 * transientFailures));
      continue;
    }
    transientFailures = 0;
    const collection = parseGeoJsonFeatureCollection(text);
    if (!collection.features.length) break;
    features.push(...collection.features);
    startIndex += collection.features.length;
    if (collection.features.length < 100) break;
  }
  if (features.length === 0) {
    throw new Error(
      "Trafikverket RoadLink WFS returned 0 features for the requested bbox. Treating the provider as unavailable.",
    );
  }
  const retrievedAt = new Date().toISOString();
  const hash = createHash("sha256")
    .update(`${SLUG}|${features.length}|${bbox.west}|${bbox.south}|${bbox.east}|${bbox.north}`)
    .digest("hex");
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
    publisher: "Trafikverket",
    dataset: "INSPIRE RoadLink / NVDB",
    license: "CC0",
    attribution: "Trafikverket NVDB",
    bbox,
    feature_count: features.length,
    commercial_use: "CC0",
  }))}::jsonb
)
returning id;
`);
  const snapshotId = inserted[0].id;
  let processed = 0;
  for (const feature of features) {
    const geom = normalizeRoadGeometry(feature.geometry);
    if (!geom || (geom.type !== "LineString" && geom.type !== "MultiLineString")) continue;
    const props = feature.properties ?? {};
    const externalId = String(props.localId ?? props.inspireId ?? props.OBJECTID ?? `${processed}-${JSON.stringify(geom.coordinates[0])}`).slice(0, 200);
    const roadClass = props.functionalRoadClass ?? props.roadForm ?? props.formOfWay ?? null;
    query(`
insert into public.official_transport_features (
  source_id, snapshot_id, feature_class, external_id, name, road_class, geom, properties, fetched_at
) values (
  ${quoteSql(source.id)}::uuid,
  ${quoteSql(snapshotId)}::uuid,
  'road_link',
  ${quoteSql(externalId)},
  ${quoteSqlNullable(props.nationalRoadNumber ?? props.name ?? null)},
  ${quoteSqlNullable(roadClass)},
  extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson(${quoteSql(JSON.stringify(geom))}), 4326)),
  ${quoteSql(JSON.stringify(props))}::jsonb,
  ${quoteSql(retrievedAt)}::timestamptz
)
on conflict (source_id, external_id) do update
set snapshot_id = excluded.snapshot_id, geom = excluded.geom, road_class = excluded.road_class,
    properties = excluded.properties, fetched_at = excluded.fetched_at, updated_at = now();
`);
    processed += 1;
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
    metadata: { bbox, feature_count: processed, probe_only: false },
  });
  console.log(JSON.stringify({ event: "ingest.roads.complete", features: processed, bbox }));
} catch (error) {
  const message = error instanceof Error ? error.message : "failed";
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
        errorMessage:
          message +
          " Trafikverket open WFS is not a reliable production feed (HTTP 400 / ExceptionReport in live proof). Official RoadLink is published via Lastkajen. Set TRAFIKVERKET_ROADLINK_GPKG when an operator GeoPackage is available. Until then road access stays not evaluated and does not block Candidate generation.",
        metadata: { dataset: SLUG, bbox, blocker: "trafikverket_wfs_http_400" },
      });
    } catch {
      // ignore
    }
  }
  console.log(
    JSON.stringify({
      event: "ingest.roads.unavailable",
      bbox,
      blocker: "Trafikverket INSPIRE WFS HTTP 400 / ExceptionReport. No OSM fallback. Road access not evaluated.",
      message: message.slice(0, 240),
    }),
  );
  process.exit(0);
}
