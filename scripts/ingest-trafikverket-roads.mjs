/**
 * Ingest Trafikverket INSPIRE RoadLink (NVDB) for screening proximity.
 *
 * Publisher: Trafikverket
 * Dataset: INSPIRE Transport Networks — RoadLink
 * Licence: CC0
 * WFS: https://geo-inspire.trafikverket.se/MapService/wfs.axd/TN_RoadTransportNetwork
 * Official GetFeature: typeNames=RoadLink (not tn-ro:RoadLink)
 * EPSG:4326 bbox axis on this service: lat,lon
 *
 * Screening metric: distance to nearest official road geometry.
 * That is road proximity, not construction access.
 *
 * Usage: node scripts/ingest-trafikverket-roads.mjs --bbox=14.9,59.1,15.4,59.4
 *        node scripts/ingest-trafikverket-roads.mjs --backfill-only
 * --backfill-only reuses catalog RoadLink features (no WFS refetch) and
 * writes screening proximity onto existing Candidates, then re-ranks.
 * Opportunity screening_snapshot rows are never rewritten.
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
import { buildRoadLinkWfsUrl, TRAFIKVERKET_ROADLINK_WFS } from "./lib/trafikverket-roadlink.mjs";

const SLUG = "trafikverket-inspire-roadlink";

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

async function fetchRoadPage(bbox, axis) {
  const text = await fetchOpenGeodataText(buildRoadLinkWfsUrl(bbox, 0, axis), { timeoutMs: 90_000 });
  if (text.includes("ExceptionReport") || text.includes("ows:Exception")) {
    throw new Error(`Trafikverket WFS ExceptionReport: ${text.slice(0, 240)}`);
  }
  return parseGeoJsonFeatureCollection(text).features;
}

function splitBbox(area) {
  const midX = (area.west + area.east) / 2;
  const midY = (area.south + area.north) / 2;
  return [
    { west: area.west, south: area.south, east: midX, north: midY },
    { west: midX, south: area.south, east: area.east, north: midY },
    { west: area.west, south: midY, east: midX, north: area.north },
    { west: midX, south: midY, east: area.east, north: area.north },
  ];
}

async function collectRoadFeatures(area, axis, depth, seen, acc) {
  const page = await fetchRoadPage(area, axis);
  if (page.length >= 5000 && depth < 5) {
    console.log(JSON.stringify({ event: "ingest.roads.split", depth, bbox: area, count: page.length }));
    for (const child of splitBbox(area)) {
      await collectRoadFeatures(child, axis, depth + 1, seen, acc);
    }
    return;
  }
  console.log(JSON.stringify({ event: "ingest.roads.tile", depth, count: page.length, kept: acc.length }));
  for (const feature of page) {
    const id = String(feature.id ?? feature.properties?.name ?? JSON.stringify(feature.geometry?.coordinates?.[0]));
    if (seen.has(id)) continue;
    seen.add(id);
    acc.push(feature);
  }
}

function nearestRoadBackfillSql(area) {
  return `
update public.opportunity_run_candidates as c
set
  road_queried = true,
  road_distance_m = nearest.road_distance_m,
  road_class = nearest.road_class
from (
  select
    c2.id,
    road.road_distance_m,
    road.road_class
  from public.opportunity_run_candidates as c2
  join lateral (
    select
      extensions.st_distance(c2.geom::extensions.geography, t.geom::extensions.geography) as road_distance_m,
      t.road_class
    from public.official_transport_features as t
    where t.feature_class = 'road_link'
    order by c2.geom operator(extensions.<->) t.geom
    limit 1
  ) as road on road.road_distance_m is not null
  where c2.geom && extensions.st_makeenvelope(${area.west}, ${area.south}, ${area.east}, ${area.north}, 4326)
    and coalesce(c2.candidate_kind, 'site') = 'site'
) as nearest
where c.id = nearest.id
returning c.id, c.road_distance_m;
`;
}

function nearestRoadOneSql(candidateId) {
  return `
update public.opportunity_run_candidates as c
set
  road_queried = true,
  road_distance_m = road.road_distance_m,
  road_class = road.road_class
from lateral (
  select
    extensions.st_distance(c.geom::extensions.geography, t.geom::extensions.geography) as road_distance_m,
    t.road_class
  from public.official_transport_features as t
  where t.feature_class = 'road_link'
  order by c.geom operator(extensions.<->) t.geom
  limit 1
) as road
where c.id = ${quoteSql(candidateId)}::uuid
  and road.road_distance_m is not null
returning c.id, c.road_distance_m;
`;
}

const bbox = parseBbox(process.argv.slice(2));
const backfillOnly = process.argv.includes("--backfill-only");
const stripStaleRoadWarningOnly = process.argv.includes("--strip-stale-road-warning");
const ingestTarget = resolveIngestTarget();
const queryRaw = (sql) => queryIngestSql(ingestTarget, sql);
function query(sql) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return queryRaw(sql);
    } catch (error) {
      lastError = error;
      const message = String(error?.message ?? error);
      if (!/Access token not provided|LegacyPlatformAuthRequiredError/i.test(message) || attempt === 4) {
        throw error;
      }
      console.log(JSON.stringify({ event: "ingest.roads.auth_retry", attempt: attempt + 1 }));
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000 * (attempt + 1));
    }
  }
  throw lastError;
}

function releaseStaleRoadIngestLock() {
  const running = query(`
select r.id::text as id
from public.source_ingestion_runs as r
join public.grid_sources as g on g.id = r.grid_source_id
where g.slug = ${quoteSql(SLUG)}
  and r.status = 'running';
`);
  for (const row of running) {
    completeIngestionRun(query, quoteSql, quoteSqlNullable, {
      runId: row.id,
      status: "failed",
      snapshotId: null,
      sourceChanged: null,
      observationsProcessed: null,
      externalChangesCreated: null,
      impactsCreated: null,
      errorCode: "database",
      errorMessage: "Released stale RoadLink ingest lock after a statement timeout.",
      metadata: { dataset: SLUG, bbox, released_stale_lock: true },
    });
    console.log(JSON.stringify({ event: "ingest.roads.lock_released", runId: row.id }));
  }
}

function countRoadFeatures() {
  const rows = query(`
select count(*)::int as count
from public.official_transport_features
where feature_class = 'road_link'
  and geom && extensions.st_makeenvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326);
`);
  return Number(rows[0]?.count ?? 0);
}

function backfillRoadProximity() {
  try {
    const rows = query(nearestRoadBackfillSql(bbox));
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    const message = String(error?.message ?? error);
    if (!/timeout|57014/i.test(message)) throw error;
    console.log(JSON.stringify({ event: "ingest.roads.backfill_timeout_fallback", message: message.slice(0, 180) }));
    const ids = query(`
select id::text as id
from public.opportunity_run_candidates
where geom && extensions.st_makeenvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326)
  and coalesce(candidate_kind, 'site') = 'site';
`);
    const out = [];
    for (const row of ids) {
      out.push(...(query(nearestRoadOneSql(row.id)) ?? []));
    }
    return out;
  }
}

function markRunsRoadProviderAvailable() {
  query(`
update public.opportunity_search_runs
set
  provider_availability = coalesce(provider_availability, '{}'::jsonb) || jsonb_build_object('trafikverket-inspire-roadlink', true),
  warnings = coalesce((
    select jsonb_agg(to_jsonb(t.value) order by t.ord)
    from jsonb_array_elements_text(coalesce(warnings, '[]'::jsonb)) with ordinality as t(value, ord)
    where t.value <> 'Road-access rules are configured, but Trafikverket RoadLink has not been ingested for this geography. The constraint was not applied.'
  ), '[]'::jsonb)
where west is not null
  and east is not null
  and south is not null
  and north is not null
  and west <= ${bbox.east}
  and east >= ${bbox.west}
  and south <= ${bbox.north}
  and north >= ${bbox.south};
`);
}

async function rankRoadAssessments() {
  try {
    const { refreshRoadAssessmentsForBbox } = await import("./lib/refresh-road-assessments.ts");
    const ranked = refreshRoadAssessmentsForBbox({ query, quoteSql, bbox });
    console.log(JSON.stringify({ event: "ingest.roads.ranked", ...ranked }));
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "ingest.roads.rank_skipped",
        message: String(error instanceof Error ? error.message : error).slice(0, 240),
      }),
    );
  }
}

let ingestionRunId = null;

if (stripStaleRoadWarningOnly) {
  markRunsRoadProviderAvailable();
  console.log(JSON.stringify({ event: "ingest.roads.stale_warning_stripped", bbox }));
  process.exit(0);
}

if (backfillOnly) {
  try {
    releaseStaleRoadIngestLock();
    const featureCount = countRoadFeatures();
    console.log(JSON.stringify({ event: "ingest.roads.catalog", featureCount, bbox }));
    if (featureCount === 0) {
      console.log(
        JSON.stringify({
          event: "ingest.roads.unavailable",
          bbox,
          blocker:
            "Official RoadLink is not in the catalog yet. No OSM fallback. Road access not evaluated.",
        }),
      );
      process.exit(0);
    }
    const backfill = backfillRoadProximity();
    markRunsRoadProviderAvailable();
    const source = query(`select id from public.grid_sources where slug = ${quoteSql(SLUG)};`)[0];
    const snapshot = source
      ? query(`
select id from public.source_snapshots
where source_id = ${quoteSql(source.id)}::uuid
order by retrieved_at desc
limit 1;
`)[0]
      : null;
    const begun = beginIngestionRun(query, quoteSql, { slug: SLUG, trigger: ingestTriggerType() });
    if (begun?.outcome !== "skipped_locked" && begun?.outcome !== "skipped_not_due") {
      completeIngestionRun(query, quoteSql, quoteSqlNullable, {
        runId: begun.run_id,
        status: "success",
        snapshotId: snapshot?.id ?? null,
        sourceChanged: false,
        observationsProcessed: featureCount,
        externalChangesCreated: 0,
        impactsCreated: 0,
        errorCode: null,
        errorMessage: null,
        metadata: {
          bbox,
          feature_count: featureCount,
          candidates_with_road_proximity: backfill.length,
          backfill_only: true,
        },
      });
    }
    console.log(
      JSON.stringify({
        event: "ingest.roads.complete",
        features: featureCount,
        axis: "catalog",
        candidatesWithProximity: backfill.length,
        bbox,
        backfillOnly: true,
      }),
    );
    await rankRoadAssessments();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed";
    console.log(
      JSON.stringify({
        event: "ingest.roads.unavailable",
        bbox,
        blocker:
          "Official RoadLink was fetched but candidate proximity could not be written. No OSM fallback. Road access not evaluated.",
        message: message.slice(0, 240),
      }),
    );
    process.exit(0);
  }
}

try {
  query(`
insert into public.grid_sources (
  name, slug, source_type, publisher, base_url, country_code, active, authority_level, update_frequency, refresh_interval_hours
) values (
  'Trafikverket — INSPIRE RoadLink (NVDB)',
  ${quoteSql(SLUG)},
  'gis',
  'Trafikverket',
  ${quoteSql(TRAFIKVERKET_ROADLINK_WFS)},
  'SE',
  true,
  'official',
  'as_published',
  168
)
on conflict (slug) do update set name = excluded.name, active = true, base_url = excluded.base_url;
`);
  const begun = beginIngestionRun(query, quoteSql, { slug: SLUG, trigger: ingestTriggerType() });
  if (begun?.outcome === "skipped_locked" || begun?.outcome === "skipped_not_due") {
    console.log(JSON.stringify({ event: "ingest.roads.skipped", reason: begun.outcome }));
    process.exit(0);
  }
  ingestionRunId = begun.run_id;
  const features = [];
  const seen = new Set();
  let axis = "latlon";
  try {
    await collectRoadFeatures(bbox, "latlon", 0, seen, features);
  } catch (error) {
    console.log(JSON.stringify({ event: "ingest.roads.latlon_failed", message: String(error).slice(0, 180) }));
  }
  if (features.length === 0) {
    axis = "lonlat";
    await collectRoadFeatures(bbox, "lonlat", 0, seen, features);
  }
  if (features.length === 0) {
    throw new Error(
      "Trafikverket RoadLink WFS returned 0 features for the requested bbox. Treating the provider as unavailable.",
    );
  }
  const retrievedAt = new Date().toISOString();
  const hash = createHash("sha256")
    .update(`${SLUG}|${features.length}|${bbox.west}|${bbox.south}|${bbox.east}|${bbox.north}|${axis}`)
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
    axis,
    commercial_use: "CC0",
  }))}::jsonb
)
on conflict (source_id, content_hash) do update
set retrieved_at = excluded.retrieved_at, status = excluded.status, metadata = excluded.metadata
returning id;
`);
  const snapshotId = inserted[0].id;
  const compact = [];
  for (const [index, feature] of features.entries()) {
    const geom = normalizeRoadGeometry(feature.geometry);
    if (!geom || (geom.type !== "LineString" && geom.type !== "MultiLineString")) continue;
    const props = feature.properties ?? {};
    compact.push({
      id: String(
        feature.id ?? props.localId ?? props.inspireId ?? props.name ?? props.OBJECTID ?? `${index}`,
      ).slice(0, 200),
      name: typeof props.nationalRoadNumber === "string" ? props.nationalRoadNumber : null,
      cls: props.functionalRoadClass ?? props.roadForm ?? props.formOfWay ?? null,
      geom,
    });
  }
  const BATCH = 800;
  let processed = 0;
  for (let i = 0; i < compact.length; i += BATCH) {
    const payload = JSON.stringify(compact.slice(i, i + BATCH));
    query(`
insert into public.official_transport_features (
  source_id, snapshot_id, feature_class, external_id, name, road_class, geom, properties, fetched_at
)
select
  ${quoteSql(source.id)}::uuid,
  ${quoteSql(snapshotId)}::uuid,
  'road_link',
  rec->>'id',
  nullif(rec->>'name', ''),
  nullif(rec->>'cls', ''),
  extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson(rec->>'geom'), 4326)),
  '{}'::jsonb,
  ${quoteSql(retrievedAt)}::timestamptz
from jsonb_array_elements(${quoteSql(payload)}::jsonb) as rec
on conflict (source_id, external_id) do update
set snapshot_id = excluded.snapshot_id, geom = excluded.geom, road_class = excluded.road_class,
    fetched_at = excluded.fetched_at, updated_at = now();
`);
    processed += Math.min(BATCH, compact.length - i);
    console.log(JSON.stringify({ event: "ingest.roads.inserted", processed, total: compact.length }));
  }

  const backfill = backfillRoadProximity();
  markRunsRoadProviderAvailable();

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
    metadata: {
      bbox,
      feature_count: processed,
      axis,
      candidates_with_road_proximity: Array.isArray(backfill) ? backfill.length : 0,
      probe_only: false,
    },
  });
  console.log(
    JSON.stringify({
      event: "ingest.roads.complete",
      features: processed,
      axis,
      candidatesWithProximity: Array.isArray(backfill) ? backfill.length : 0,
      bbox,
    }),
  );

  await rankRoadAssessments();
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
        errorMessage: message,
        metadata: { dataset: SLUG, bbox },
      });
    } catch {
      // ignore
    }
  }
  console.log(
    JSON.stringify({
      event: "ingest.roads.unavailable",
      bbox,
      blocker:
        /Access token|postgres|sql|database/i.test(message)
          ? "Official RoadLink was fetched but could not be written to the catalog. No OSM fallback. Road access not evaluated."
          : "Trafikverket INSPIRE RoadLink WFS did not return usable features. No OSM fallback. Road access not evaluated.",
      message: message.slice(0, 240),
    }),
  );
  process.exit(0);
}
