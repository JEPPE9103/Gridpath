/**
 * Shared SQL helpers for official ingest scripts to record source_ingestion_runs.
 * Does not store secrets. Callers must already have resolved an ingest target.
 */
export function ingestTriggerType() {
  return process.env.MONITOR_TRIGGER === "scheduled" ? "scheduled" : "manual";
}

export function sanitizeIngestError(message) {
  return String(message ?? "")
    .replace(/:\/\/[^/\s]+@/g, "://***@")
    .replace(/(service_role|eyJ[A-Za-z0-9_-]{20,})/g, "[redacted]")
    .slice(0, 280);
}

export function classifyIngestError(error) {
  const message = String(error?.message ?? error);
  if (/already_running|skipped_locked/i.test(message)) return "already_running";
  if (
    /failed to fetch|fetch failed|econnreset|etimedout|enotfound|network|timeout| 429 | 502 | 503 | 504 /i.test(
      message,
    )
  ) {
    return "transient_fetch";
  }
  if (/parse|xlsx|shapefile|invalid workbook|zip|schema|could not discover/i.test(message)) {
    return "source_format";
  }
  if (/postgres|database|sql|permission denied|connection terminated/i.test(message)) {
    return "database";
  }
  return "ingest_error";
}

export function beginIngestionRun(query, quoteSql, { slug, trigger }) {
  const rows = query(`
select run_id, source_id, outcome, error_code
from private.begin_source_ingestion_run(${quoteSql(slug)}, ${quoteSql(trigger)});
`);
  return rows[0];
}

export function completeIngestionRun(query, quoteSql, quoteSqlNullable, input) {
  const metadata = JSON.stringify(input.metadata ?? {});
  query(`
select private.complete_source_ingestion_run(
  ${quoteSql(input.runId)}::uuid,
  ${quoteSql(input.status)},
  ${input.snapshotId ? `${quoteSql(input.snapshotId)}::uuid` : "null"},
  ${input.sourceChanged == null ? "null" : input.sourceChanged ? "true" : "false"},
  ${input.observationsProcessed == null ? "null" : Number(input.observationsProcessed)},
  ${input.externalChangesCreated == null ? "null" : Number(input.externalChangesCreated)},
  ${input.impactsCreated == null ? "null" : Number(input.impactsCreated)},
  ${quoteSqlNullable(input.errorCode)},
  ${quoteSqlNullable(sanitizeIngestError(input.errorMessage))},
  ${quoteSql(metadata)}::jsonb
);
`);
}
