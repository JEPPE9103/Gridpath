/**
 * Ingest Naturvårdsverket WFS layers (CC0) into official_geographic_features.
 *
 * Protected areas: Naturvardsregistret_WFS:SkyddadeOmraden
 * Natura 2000: N2000_WFS:N2000
 *
 * Does not fabricate geometry. Does not claim legal impossibility of development.
 * Default: local Supabase only. Cloud requires the same remote ingest flags as Ei ingest.
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

const PAGE_SIZE = 100;

const DATASETS = {
  protected: {
    slug: "nv-protected-areas",
    name: "Naturvårdsverket — Naturvårdsregistret protected areas",
    publisher: "Naturvårdsverket",
    featureClass: "protected_area",
    wfsBase: "https://geodata.naturvardsverket.se/naturvardsregistret/wfs",
    typeName: "Naturvardsregistret_WFS:SkyddadeOmraden",
    idProperty: "NVRID",
    nameProperty: "NAMN",
    designationProperty: "SKYDDSTYP",
    license: "CC0",
    attribution: "Källa: Naturvårdsverket",
  },
  natura: {
    slug: "nv-natura-2000",
    name: "Naturvårdsverket — Natura 2000",
    publisher: "Naturvårdsverket",
    featureClass: "natura_2000",
    wfsBase: "https://geodata.naturvardsverket.se/n2000/wfs",
    typeName: "N2000_WFS:N2000",
    idProperty: "OMRADESKOD",
    nameProperty: "OMRADESNAMN",
    designationProperty: "OMRADESTYP",
    license: "CC0",
    attribution: "Källa: Naturvårdsverket",
  },
};

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function quoteSqlNullable(value) {
  return value == null || value === "" ? "null" : quoteSql(value);
}

function featureExternalId(properties, dataset) {
  const raw =
    properties?.[dataset.idProperty] ??
    properties?.NVRID ??
    properties?.OMRADESKOD ??
    properties?.Sitecode ??
    properties?.SITECODE ??
    properties?.GmlID ??
    properties?.OBJECTID;
  return raw == null ? null : String(raw).trim();
}

function featureName(properties, dataset) {
  return (
    properties?.[dataset.nameProperty] ??
    properties?.NAMN ??
    properties?.OMRADESNAMN ??
    properties?.Namn ??
    properties?.NAME ??
    null
  );
}

function featureDesignation(properties, dataset) {
  return (
    properties?.[dataset.designationProperty] ??
    properties?.SKYDDSTYP ??
    properties?.OMRADESTYP ??
    properties?.OmradesTyp ??
    null
  );
}

function buildWfsUrl(dataset, startIndex) {
  const url = new URL(dataset.wfsBase);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("typeNames", dataset.typeName);
  url.searchParams.set("outputFormat", "GEOJSON");
  url.searchParams.set("srsName", "EPSG:4326");
  url.searchParams.set("count", String(PAGE_SIZE));
  url.searchParams.set("startIndex", String(startIndex));
  return url.href;
}

async function fetchAllFeatures(dataset) {
  const features = [];
  let startIndex = 0;
  while (true) {
    const text = await fetchOpenGeodataText(buildWfsUrl(dataset, startIndex));
    const collection = parseGeoJsonFeatureCollection(text);
    if (!collection.features.length) break;
    features.push(...collection.features);
    startIndex += collection.features.length;
    if (collection.features.length < PAGE_SIZE) break;
    if (startIndex > 200_000) {
      throw new Error("WFS paging exceeded the safety cap.");
    }
  }
  return features;
}

function contentHashForFeatures(features, dataset) {
  const ids = features
    .map((feature) => featureExternalId(feature.properties, dataset))
    .filter(Boolean)
    .sort();
  return createHash("sha256")
    .update(`${dataset.slug}|${ids.length}|${ids.join(",")}`)
    .digest("hex");
}

function upsertBatchSql(sourceId, snapshotId, dataset, features, fetchedAt) {
  const values = [];
  for (const feature of features) {
    const externalId = featureExternalId(feature.properties, dataset);
    if (!externalId || !feature.geometry) continue;
    const geomType = feature.geometry.type;
    if (geomType !== "Polygon" && geomType !== "MultiPolygon") continue;
    const geomJson = JSON.stringify(feature.geometry);
    values.push(`(
      ${quoteSql(sourceId)}::uuid,
      ${quoteSql(snapshotId)}::uuid,
      ${quoteSql(dataset.featureClass)},
      ${quoteSql(externalId)},
      ${quoteSqlNullable(featureName(feature.properties, dataset))},
      ${quoteSqlNullable(featureDesignation(feature.properties, dataset))},
      ${quoteSqlNullable(feature.properties?.KOMMUN ?? feature.properties?.Kommun ?? null)},
      ${quoteSqlNullable(feature.properties?.LAN ?? feature.properties?.Lan ?? null)},
      ${feature.properties?.AREA_HA == null ? "null" : Number(feature.properties.AREA_HA)},
      extensions.st_multi(
        extensions.st_collectionextract(
          extensions.st_makevalid(
            extensions.st_setsrid(extensions.st_geomfromgeojson(${quoteSql(geomJson)}), 4326)
          ),
          3
        )
      ),
      ${quoteSql(JSON.stringify(feature.properties ?? {}))}::jsonb,
      ${quoteSql(fetchedAt)}::timestamptz
    )`);
  }
  if (values.length === 0) return null;
  return `
insert into public.official_geographic_features (
  source_id, snapshot_id, feature_class, external_id, name, designation,
  municipality, county, area_ha, geom, properties, fetched_at
) values
${values.join(",\n")}
on conflict (source_id, external_id) do update
set
  snapshot_id = excluded.snapshot_id,
  name = excluded.name,
  designation = excluded.designation,
  municipality = excluded.municipality,
  county = excluded.county,
  area_ha = excluded.area_ha,
  geom = excluded.geom,
  properties = excluded.properties,
  fetched_at = excluded.fetched_at,
  updated_at = now()
where not extensions.st_isempty(excluded.geom);
`;
}

export async function ingestNaturvardsverketDataset(key) {
  const dataset = DATASETS[key];
  if (!dataset) {
    throw new Error(`Unknown Naturvårdsverket dataset: ${key}`);
  }

  const ingestTarget = resolveIngestTarget();
  const query = (sql) => queryIngestSql(ingestTarget, sql);
  let ingestionRunId = null;

  try {
    query(`
insert into public.grid_sources (
  name, slug, source_type, publisher, base_url, country_code, active, authority_level, update_frequency, refresh_interval_hours
) values (
  ${quoteSql(dataset.name)},
  ${quoteSql(dataset.slug)},
  'gis',
  ${quoteSql(dataset.publisher)},
  ${quoteSql(dataset.wfsBase)},
  'SE',
  true,
  'official',
  'as_published',
  168
)
on conflict (slug) do update
set
  name = excluded.name,
  publisher = excluded.publisher,
  base_url = excluded.base_url,
  active = true,
  authority_level = 'official';
`);

    const begun = beginIngestionRun(query, quoteSql, {
      slug: dataset.slug,
      trigger: ingestTriggerType(),
    });
    if (begun?.outcome === "skipped_locked") {
      console.log(JSON.stringify({ event: "ingest.nv.skipped", slug: dataset.slug, reason: "locked" }));
      return;
    }
    if (begun?.outcome === "skipped_not_due") {
      console.log(JSON.stringify({ event: "ingest.nv.skipped", slug: dataset.slug, reason: "not_due" }));
      return;
    }
    ingestionRunId = begun.run_id;

    const retrievedAt = new Date().toISOString();
    const features = await fetchAllFeatures(dataset);
    const hash = contentHashForFeatures(features, dataset);

    const existing = query(`
select id, status
from public.source_snapshots
where source_id = (select id from public.grid_sources where slug = ${quoteSql(dataset.slug)})
  and content_hash = ${quoteSql(hash)};
`);

    const source = query(`
select id from public.grid_sources where slug = ${quoteSql(dataset.slug)};
`)[0];
    if (!source?.id) throw new Error("grid_sources row missing after upsert.");

    if (existing[0]) {
      const snapshotId = existing[0].id;
      const countRows = query(`
select count(*)::int as n
from public.official_geographic_features
where source_id = ${quoteSql(source.id)}::uuid;
`);
      completeIngestionRun(query, quoteSql, quoteSqlNullable, {
        runId: ingestionRunId,
        status: "success",
        snapshotId,
        sourceChanged: false,
        observationsProcessed: countRows[0]?.n ?? features.length,
        externalChangesCreated: 0,
        impactsCreated: 0,
        errorCode: null,
        errorMessage: null,
        metadata: {
          dataset: dataset.typeName,
          license: dataset.license,
          feature_count: features.length,
          probe_only: false,
          unchanged: true,
        },
      });
      console.log(
        JSON.stringify({
          event: "ingest.nv.complete",
          slug: dataset.slug,
          features: features.length,
          sourceChanged: false,
        }),
      );
      return;
    }

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
  ${quoteSql(
    JSON.stringify({
      publisher: dataset.publisher,
      dataset: dataset.typeName,
      license: dataset.license,
      attribution: dataset.attribution,
      wfs: dataset.wfsBase,
      crs: "EPSG:4326",
      feature_count: features.length,
      commercial_use: "CC0 — no copyright restriction; attribution preferred",
    }),
  )}::jsonb
)
returning id;
`);
    const snapshotId = inserted[0].id;
    const sourceChanged = true;

    const BATCH = 5;
    let processed = 0;
    for (let i = 0; i < features.length; i += BATCH) {
      const sql = upsertBatchSql(source.id, snapshotId, dataset, features.slice(i, i + BATCH), retrievedAt);
      if (!sql) continue;
      try {
        query(sql);
        processed += Math.min(BATCH, features.length - i);
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "ingest.nv.batch_failed",
            slug: dataset.slug,
            offset: i,
            message: error instanceof Error ? error.message.slice(0, 300) : "failed",
          }),
        );
      }
    }

    query(`
delete from public.official_geographic_features
where source_id = ${quoteSql(source.id)}::uuid
  and (snapshot_id is distinct from ${quoteSql(snapshotId)}::uuid);
`);

    completeIngestionRun(query, quoteSql, quoteSqlNullable, {
      runId: ingestionRunId,
      status: "success",
      snapshotId,
      sourceChanged,
      observationsProcessed: processed,
      externalChangesCreated: 0,
      impactsCreated: 0,
      errorCode: null,
      errorMessage: null,
      metadata: {
        dataset: dataset.typeName,
        license: dataset.license,
        feature_count: features.length,
        probe_only: false,
      },
    });

    console.log(
      JSON.stringify({
        event: "ingest.nv.complete",
        slug: dataset.slug,
        features: features.length,
        sourceChanged,
      }),
    );
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
          metadata: { dataset: dataset.typeName },
        });
      } catch {
        // ignore completion failure
      }
    }
    throw error;
  }
}
