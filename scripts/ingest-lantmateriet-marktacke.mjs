/**
 * Probe Lantmäteriet Marktäcke Nedladdning, vektor (STAC).
 * Complementary to NMD — does not replace NMD thematic classes.
 * Records AUTH_REQUIRED when Geotorget credentials are missing.
 *
 * Product: Marktäcke Nedladdning, vektor
 * STAC: https://api.lantmateriet.se/stac-vektor/v1/collections/marktacke
 * Delivery: GeoPackage, avgiftsfri, valuable-dataset terms
 *
 * Usage: node scripts/ingest-lantmateriet-marktacke.mjs
 */
import { queryIngestSql, resolveIngestTarget } from "./lib/ingest-target.mjs";
import {
  beginIngestionRun,
  classifyIngestError,
  completeIngestionRun,
  ingestTriggerType,
} from "./lib/ingestion-runs.mjs";

const SLUG = "lm-marktacke";
const STAC = "https://api.lantmateriet.se/stac-vektor/v1/collections/marktacke";

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}
function quoteSqlNullable(value) {
  return value == null || value === "" ? "null" : quoteSql(value);
}

function credentials() {
  const token = process.env.LANTMATERIET_STAC_TOKEN?.trim();
  const user = process.env.LANTMATERIET_GEOTORGET_USERNAME?.trim();
  const password = process.env.LANTMATERIET_GEOTORGET_PASSWORD?.trim();
  if (token) return { authorization: `Bearer ${token}` };
  if (user && password) return { authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}` };
  return null;
}

const ingestTarget = resolveIngestTarget();
const query = (sql) => queryIngestSql(ingestTarget, sql);
let ingestionRunId = null;

try {
  query(`
insert into public.grid_sources (
  name, slug, source_type, publisher, base_url, country_code, active, authority_level, update_frequency, refresh_interval_hours
) values (
  'Lantmäteriet — Marktäcke Nedladdning, vektor',
  ${quoteSql(SLUG)},
  'gis',
  'Lantmäteriet',
  ${quoteSql(STAC)},
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
    console.log(JSON.stringify({ event: "ingest.marktacke.skipped", reason: begun.outcome }));
    process.exit(0);
  }
  ingestionRunId = begun.run_id;
  const auth = credentials();
  if (!auth) {
    completeIngestionRun(query, quoteSql, quoteSqlNullable, {
      runId: ingestionRunId,
      status: "skipped",
      snapshotId: null,
      sourceChanged: false,
      observationsProcessed: 0,
      externalChangesCreated: 0,
      impactsCreated: 0,
      errorCode: "auth_required",
      errorMessage:
        "Lantmäteriet Marktäcke requires a Geotorget account and API access. Set LANTMATERIET_GEOTORGET_USERNAME/PASSWORD or LANTMATERIET_STAC_TOKEN. This source is complementary to NMD and is not used as the primary land-cover evidence until authorised ingest succeeds.",
      metadata: {
        state: "AUTH_REQUIRED",
        probe_only: true,
        product: "Marktäcke Nedladdning, vektor",
        stac: STAC,
        replaces_nmd: false,
      },
    });
    console.log(JSON.stringify({ event: "ingest.marktacke.auth_required" }));
    process.exit(0);
  }

  const response = await fetch(STAC, {
    headers: {
      authorization: auth.authorization,
      accept: "application/json",
      "user-agent": "NOXHEIM/1.0 (+https://www.noxheim.com; lantmateriet-stac)",
    },
  });
  if (!response.ok) {
    throw new Error(`Lantmäteriet Marktäcke STAC HTTP ${response.status}`);
  }
  const payload = await response.json();
  completeIngestionRun(query, quoteSql, quoteSqlNullable, {
    runId: ingestionRunId,
    status: "success",
    snapshotId: null,
    sourceChanged: false,
    observationsProcessed: 0,
    externalChangesCreated: 0,
    impactsCreated: 0,
    errorCode: null,
    errorMessage: null,
    metadata: {
      state: "AVAILABLE",
      id: payload?.id ?? null,
      title: payload?.title ?? null,
      note: "Collection reachable. Vector features are not written until a bounded GeoPackage extract is implemented. NMD remains the primary land-cover source.",
      probe_only: true,
      replaces_nmd: false,
    },
  });
  console.log(JSON.stringify({ event: "ingest.marktacke.stac_ok", id: payload?.id ?? null }));
} catch (error) {
  if (ingestionRunId) {
    try {
      completeIngestionRun(query, quoteSql, quoteSqlNullable, {
        runId: ingestionRunId,
        status: "failed",
        snapshotId: null,
        sourceChanged: false,
        observationsProcessed: 0,
        externalChangesCreated: 0,
        impactsCreated: 0,
        errorCode: classifyIngestError(error),
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "failed",
        metadata: { probe_only: true },
      });
    } catch {
      // ignore
    }
  }
  console.error(error);
  process.exit(1);
}
