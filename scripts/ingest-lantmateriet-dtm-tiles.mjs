/**
 * On-demand Lantmäteriet 1 m DTM acquisition for a candidate bbox.
 * Does not ingest Sweden nationwide. Records AUTH_REQUIRED when credentials are missing.
 *
 * Usage: node scripts/ingest-lantmateriet-dtm-tiles.mjs --bbox=14.9,59.1,15.4,59.4
 */
import { queryIngestSql, resolveIngestTarget } from "./lib/ingest-target.mjs";
import {
  beginIngestionRun,
  classifyIngestError,
  completeIngestionRun,
  ingestTriggerType,
} from "./lib/ingestion-runs.mjs";

const SLUG = "lantmateriet-dtm-1m";
const STAC = "https://api.lantmateriet.se/stac-hojd/v1";

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
  'Lantmäteriet — Markhöjdmodell 1 m DTM',
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
    console.log(JSON.stringify({ event: "ingest.lantmateriet.skipped", reason: begun.outcome }));
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
      errorMessage: "Lantmäteriet detailed terrain provider not configured.",
      metadata: { state: "AUTH_REQUIRED", probe_only: true },
    });
    console.log(JSON.stringify({ event: "ingest.lantmateriet.auth_required" }));
    process.exit(0);
  }

  const bboxRaw = process.argv.find((item) => item.startsWith("--bbox="))?.slice("--bbox=".length) || process.env.NOXHEIM_SCREENING_INGEST_BBOX;
  if (!bboxRaw) {
    throw new Error("Provide --bbox=west,south,east,north for candidate-scoped DTM tiles.");
  }
  const [west, south, east, north] = bboxRaw.split(",").map(Number);
  const searchUrl = `${STAC}/search?bbox=${west},${south},${east},${north}&limit=20`;
  const response = await fetch(searchUrl, {
    headers: {
      authorization: auth.authorization,
      accept: "application/geo+json, application/json",
      "user-agent": "NOXHEIM/1.0 (+https://www.noxheim.com; lantmateriet-stac)",
    },
  });
  if (!response.ok) {
    throw new Error(`Lantmäteriet STAC HTTP ${response.status}`);
  }
  const payload = await response.json();
  const features = Array.isArray(payload?.features) ? payload.features : [];

  completeIngestionRun(query, quoteSql, quoteSqlNullable, {
    runId: ingestionRunId,
    status: "success",
    snapshotId: null,
    sourceChanged: false,
    observationsProcessed: features.length,
    externalChangesCreated: 0,
    impactsCreated: 0,
    errorCode: null,
    errorMessage: null,
    metadata: {
      state: "AVAILABLE",
      tiles: features.length,
      note: "Tile metadata listed. Derived slope summaries are written during candidate refinement, not as a nationwide ingest.",
      probe_only: false,
    },
  });
  console.log(JSON.stringify({ event: "ingest.lantmateriet.stac_search", tiles: features.length }));
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
        metadata: { state: "FAILED" },
      });
    } catch {
      // ignore
    }
  }
  throw error;
}
