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
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { extractZipBytes } from "./lib/extract-zip.mjs";
import { queryIngestSql, resolveIngestTarget } from "./lib/ingest-target.mjs";
import {
  beginIngestionRun,
  classifyIngestError,
  completeIngestionRun,
  ingestTriggerType,
} from "./lib/ingestion-runs.mjs";
import { fetchOpenGeodataBytes, fetchOpenGeodataText, parseGeoJsonFeatureCollection } from "./lib/open-geodata-fetch.mjs";
import { readShapefileDir } from "./lib/shapefile.mjs";

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
    downloadBase: "https://geodata.naturvardsverket.se/nedladdning/naturvardsregistret/",
    downloadZips: ["NR.zip", "NP.zip", "NVO.zip", "NVA.zip"],
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
    downloadBase: "https://geodata.naturvardsverket.se/nedladdning/naturvardsregistret/",
    downloadZips: ["SPA_Rikstackande.zip"],
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
    properties?.NVRId ??
    properties?.OMRADESKOD ??
    properties?.Sitecode ??
    properties?.SITECODE ??
    properties?.GmlID ??
    properties?.OBJECTID ??
    dbfValue(properties ?? {}, [dataset.idProperty, "NVRID", "NVR_ID", "OMRADESKOD", "SITECODE", "Sitecode", "ID"]);
  if (raw == null || String(raw).trim() === "") {
    const zip = properties?._downloadZip ?? "zip";
    const fallback = properties?.NAMN ?? properties?.NAME ?? properties?.OMRADESNAMN;
    return fallback ? `${zip}:${fallback}` : null;
  }
  const id = String(raw).trim();
  return properties?._downloadZip ? `${properties._downloadZip}:${id}` : id;
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

function parseBbox(argv) {
  const raw =
    argv.find((item) => item.startsWith("--bbox="))?.slice("--bbox=".length) ||
    process.env.NOXHEIM_SCREENING_INGEST_BBOX;
  if (!raw) return null;
  const [west, south, east, north] = raw.split(",").map(Number);
  if (![west, south, east, north].every(Number.isFinite) || west >= east || south >= north) {
    throw new Error("Provide --bbox=west,south,east,north.");
  }
  return { west, south, east, north };
}

function buildWfsUrl(dataset, startIndex, bbox) {
  const url = new URL(dataset.wfsBase);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("typeNames", dataset.typeName);
  url.searchParams.set("outputFormat", "GEOJSON");
  url.searchParams.set("srsName", "EPSG:4326");
  url.searchParams.set("count", String(PAGE_SIZE));
  url.searchParams.set("startIndex", String(startIndex));
  if (bbox) {
    url.searchParams.set("bbox", `${bbox.west},${bbox.south},${bbox.east},${bbox.north},EPSG:4326`);
  }
  return url.href;
}

function sridFromPrj(prjText) {
  if (!prjText) return 3006;
  if (/4326|WGS.?84/i.test(prjText)) return 4326;
  return 3006;
}

function dbfValue(row, names) {
  for (const name of names) {
    if (row[name] != null && String(row[name]).trim() !== "") return String(row[name]).trim();
  }
  const lower = names.map((name) => name.toLowerCase());
  for (const [key, value] of Object.entries(row)) {
    if (lower.includes(key.toLowerCase()) && value != null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

async function fetchDownloadFeatures(dataset) {
  const features = [];
  if (!dataset.downloadBase || !dataset.downloadZips?.length) return features;
  for (const zipName of dataset.downloadZips) {
    const url = `${dataset.downloadBase}${zipName}`;
    console.log(JSON.stringify({ event: "ingest.nv.download.start", slug: dataset.slug, zip: zipName }));
    let bytes;
    try {
      bytes = await fetchOpenGeodataBytes(url, { timeoutMs: 180_000 });
    } catch {
      continue;
    }
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "noxheim-nv-"));
    try {
      extractZipBytes(bytes, tmpDir);
      const { files, dbf, geometries } = readShapefileDir(tmpDir);
      const prj = files.prjPath ? (await import("node:fs")).readFileSync(files.prjPath, "utf8") : "";
      const srid = sridFromPrj(prj);
      for (let i = 0; i < geometries.length; i += 1) {
        const wkt = geometries[i];
        if (!wkt) continue;
        const props = dbf.records[i]?.deleted ? null : dbf.records[i]?.values ?? {};
        if (!props) continue;
        features.push({
          properties: { ...props, _downloadZip: zipName },
          geometry: null,
          wkt,
          srid,
        });
      }
    } finally {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
  return features;
}

async function fetchAllFeatures(dataset, bbox) {
  if (dataset.downloadZips?.length) {
    const downloaded = await fetchDownloadFeatures(dataset);
    if (downloaded.length) return downloaded;
  }
  const features = [];
  let startIndex = 0;
  const pageCap = bbox ? 20_000 : 200_000;
  try {
    while (true) {
      const text = await fetchOpenGeodataText(buildWfsUrl(dataset, startIndex, bbox));
      const collection = parseGeoJsonFeatureCollection(text);
      if (!collection.features.length) break;
      features.push(...collection.features);
      startIndex += collection.features.length;
      if (collection.features.length < PAGE_SIZE) break;
      if (startIndex > pageCap) {
        throw new Error("WFS paging exceeded the safety cap.");
      }
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "ingest.nv.wfs_failed",
        slug: dataset.slug,
        message: error instanceof Error ? error.message.slice(0, 200) : "failed",
      }),
    );
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
    if (!externalId || (!feature.geometry && !feature.wkt)) continue;
    const geomSql = feature.wkt
      ? `extensions.st_multi(
        extensions.st_collectionextract(
          extensions.st_makevalid(
            extensions.st_transform(
              extensions.st_setsrid(extensions.st_geomfromtext(${quoteSql(feature.wkt)}), ${Number(feature.srid) || 3006}),
              4326
            )
          ),
          3
        )
      )`
      : (() => {
          const geomType = feature.geometry?.type;
          if (geomType !== "Polygon" && geomType !== "MultiPolygon") return null;
          return `extensions.st_multi(
        extensions.st_collectionextract(
          extensions.st_makevalid(
            extensions.st_setsrid(extensions.st_geomfromgeojson(${quoteSql(JSON.stringify(feature.geometry))}), 4326)
          ),
          3
        )
      )`;
        })();
    if (!geomSql) continue;
    values.push(`(
      ${quoteSql(sourceId)}::uuid,
      ${quoteSql(snapshotId)}::uuid,
      ${quoteSql(dataset.featureClass)},
      ${quoteSql(externalId)},
      ${quoteSqlNullable(featureName(feature.properties, dataset))},
      ${quoteSqlNullable(featureDesignation(feature.properties, dataset))},
      ${quoteSqlNullable(feature.properties?.KOMMUN ?? feature.properties?.Kommun ?? dbfValue(feature.properties ?? {}, ["KOMMUN", "Kommun"]))},
      ${quoteSqlNullable(feature.properties?.LAN ?? feature.properties?.Lan ?? dbfValue(feature.properties ?? {}, ["LAN", "Lan"]))},
      ${feature.properties?.AREA_HA == null ? "null" : Number(feature.properties.AREA_HA)},
      ${geomSql},
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
  const bbox = parseBbox(process.argv.slice(2));
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
    const features = await fetchAllFeatures(dataset, bbox);
    if (features.length === 0) {
      throw new Error(
        `Naturvårdsverket WFS returned 0 features for ${dataset.slug}. Treating the layer as unavailable rather than an empty catalogue.`,
      );
    }
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
      if (Number(countRows[0]?.n) > 0) {
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
    }

    let snapshotId = existing[0]?.id ?? null;
    let sourceChanged = false;

    if (!snapshotId) {
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
      ingest_path: features[0]?.wkt ? "official_zip" : "wfs",
      commercial_use: "CC0 — no copyright restriction; attribution preferred",
    }),
  )}::jsonb
)
returning id;
`);
      snapshotId = inserted[0].id;
      sourceChanged = true;
    }

    const BATCH = 20;
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
  and (snapshot_id is distinct from ${quoteSql(snapshotId)}::uuid)
  ${
    bbox
      ? `and geom && extensions.st_setsrid(extensions.st_makeenvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}), 4326)`
      : ""
  };
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
