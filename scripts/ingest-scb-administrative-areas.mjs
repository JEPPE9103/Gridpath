/**
 * Ingest SCB Digitala gränser (CC0) for county/municipality naming and filters.
 * SCB states these simplified boundaries are not suitable for cadastral analysis.
 * They are never used to clip usable site geometry.
 *
 * Usage: node scripts/ingest-scb-administrative-areas.mjs
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

const SLUG = "scb-administrative-areas";
const WFS = "https://geodata.scb.se/geoserver/stat/ows";

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
function quoteSqlNullable(value) {
  return value == null || value === "" ? "null" : quoteSql(value);
}

function wfsUrl(typeName) {
  const url = new URL(WFS);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "1.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("typeName", typeName);
  url.searchParams.set("outputFormat", "application/json");
  url.searchParams.set("srsName", "EPSG:4326");
  return url.href;
}

function featureCodeName(props) {
  const code =
    props.LnKod ?? props.LNKOD ?? props.KnKod ?? props.KNKOD ?? props.lan_kod ?? props.kommun_kod ?? props.CODE ?? props.code;
  const name = props.LnNamn ?? props.LNNAMN ?? props.KnNamn ?? props.KNNAMN ?? props.lan ?? props.kommun ?? props.NAMN ?? props.name;
  return {
    code: code != null ? String(code) : null,
    name: name != null ? String(name) : null,
  };
}

function geometrySql(geometry) {
  return `extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson(${quoteSql(JSON.stringify(geometry))}), 4326))`;
}

const ingestTarget = resolveIngestTarget();
const query = (sql) => queryIngestSql(ingestTarget, sql);
let ingestionRunId = null;

try {
  query(`
insert into public.grid_sources (
  name, slug, source_type, publisher, base_url, country_code, active, authority_level, update_frequency, refresh_interval_hours
) values (
  'SCB — Digitala gränser (county/municipality)',
  ${quoteSql(SLUG)},
  'gis',
  'Statistiska centralbyrån',
  ${quoteSql(WFS)},
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
    console.log(JSON.stringify({ event: "ingest.scb.skipped", reason: begun.outcome }));
    process.exit(0);
  }
  ingestionRunId = begun.run_id;

  const layers = [
    { typeName: "stat:Lan", areaClass: "county" },
    { typeName: "stat:Kommuner", areaClass: "municipality" },
    { typeName: "stat:lan", areaClass: "county" },
    { typeName: "stat:kommuner", areaClass: "municipality" },
  ];
  const collected = [];
  const seen = new Set();
  for (const layer of layers) {
    try {
      const text = await fetchOpenGeodataText(wfsUrl(layer.typeName), { timeoutMs: 120_000 });
      const fc = parseGeoJsonFeatureCollection(text);
      for (const feature of fc.features) {
        const { code, name } = featureCodeName(feature.properties ?? {});
        if (!code || !name || !feature.geometry) continue;
        const key = `${layer.areaClass}:${code}`;
        if (seen.has(key)) continue;
        seen.add(key);
        collected.push({ ...layer, code, name, geometry: feature.geometry });
      }
    } catch {
      // try next typeName
    }
  }
  if (collected.length === 0) {
    throw new Error("SCB WFS did not return county/municipality GeoJSON. Layer names may have changed.");
  }

  const retrievedAt = new Date().toISOString();
  const hash = createHash("sha256").update(`${SLUG}|${collected.length}`).digest("hex");
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
    publisher: "SCB",
    dataset: "Digitala gränser",
    license: "CC0",
    limitation: "Cartographic boundaries; not cadastral analysis",
    count: collected.length,
  }))}::jsonb
)
returning id;
`);
  const snapshotId = inserted[0].id;
  for (const row of collected) {
    query(`
insert into public.official_administrative_areas (source_id, snapshot_id, area_class, code, name, geom)
values (
  ${quoteSql(source.id)}::uuid,
  ${quoteSql(snapshotId)}::uuid,
  ${quoteSql(row.areaClass)},
  ${quoteSql(row.code)},
  ${quoteSql(row.name)},
  ${geometrySql(row.geometry)}
)
on conflict (area_class, code) do update
set name = excluded.name, geom = excluded.geom, snapshot_id = excluded.snapshot_id;
`);
  }

  completeIngestionRun(query, quoteSql, quoteSqlNullable, {
    runId: ingestionRunId,
    status: "success",
    snapshotId,
    sourceChanged: true,
    observationsProcessed: collected.length,
    externalChangesCreated: 0,
    impactsCreated: 0,
    errorCode: null,
    errorMessage: null,
    metadata: { count: collected.length, license: "CC0", probe_only: false },
  });
  console.log(JSON.stringify({ event: "ingest.scb.complete", count: collected.length }));
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
