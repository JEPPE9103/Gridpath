import { cache } from "react";
import { deriveSourceHealth, sourceChangeLabel, sourceHealthLabel } from "@/lib/monitor/source-health";
import { logError } from "@/lib/observability/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SourceHealthView = {
  sourceId: string;
  slug: string;
  name: string;
  publisher: string | null;
  health: ReturnType<typeof deriveSourceHealth>;
  healthLabel: string;
  changeLabel: string;
  refreshIntervalHours: number;
  lastAttemptAt: string | null;
  lastAttemptStatus: string | null;
  lastAttemptFailed: boolean;
  lastSuccessAt: string | null;
  lastFullIngestAt: string | null;
  lastSnapshotAt: string | null;
  lastSourceChangeAt: string | null;
  nextEligibleAt: string | null;
  lastObservationsProcessed: number | null;
  lastExternalChangesCreated: number | null;
  lastImpactsCreated: number | null;
  isRunning: boolean;
};

type SourceHealthRow = {
  source_id: string;
  slug: string;
  name: string;
  publisher: string | null;
  refresh_interval_hours: number;
  last_attempt_at: string | null;
  last_attempt_status: string | null;
  last_attempt_source_changed: boolean | null;
  last_attempt_error_code: string | null;
  last_success_at: string | null;
  last_full_ingest_at: string | null;
  last_snapshot_id: string | null;
  last_snapshot_at: string | null;
  last_source_change_at: string | null;
  next_eligible_at: string | null;
  last_run_probe_only: boolean | null;
  last_run_full_ingest_required: boolean | null;
  last_observations_processed: number | null;
  last_external_changes_created: number | null;
  last_impacts_created: number | null;
  is_running: boolean | null;
};

export const getOfficialSourceHealth = cache(async (): Promise<SourceHealthView[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_source_health");
  if (error) {
    logError("source_health.list_failed", { message: error.message });
    return [];
  }

  const now = new Date();
  return ((data ?? []) as SourceHealthRow[]).map((row) => {
    const lastFull = row.last_full_ingest_at ?? row.last_success_at;
    const health = deriveSourceHealth({
      lastAttemptStatus:
        (row.last_attempt_status as "running" | "success" | "failed" | "skipped" | null) ?? null,
      lastAttemptSourceChanged: row.last_attempt_source_changed,
      lastSuccessAt: lastFull ? new Date(lastFull) : null,
      lastSnapshotAt: row.last_snapshot_at ? new Date(row.last_snapshot_at) : null,
      refreshIntervalHours: row.refresh_interval_hours,
      now,
    });
    return {
      sourceId: row.source_id,
      slug: row.slug,
      name: row.name,
      publisher: row.publisher,
      health,
      healthLabel: sourceHealthLabel(health),
      changeLabel: sourceChangeLabel(row.last_attempt_source_changed, row.last_attempt_status),
      refreshIntervalHours: row.refresh_interval_hours,
      lastAttemptAt: row.last_attempt_at,
      lastAttemptStatus: row.last_attempt_status,
      lastAttemptFailed: row.last_attempt_status === "failed",
      lastSuccessAt: row.last_success_at,
      lastFullIngestAt: row.last_full_ingest_at,
      lastSnapshotAt: row.last_snapshot_at,
      lastSourceChangeAt: row.last_source_change_at,
      nextEligibleAt: row.next_eligible_at,
      lastObservationsProcessed: row.last_observations_processed,
      lastExternalChangesCreated: row.last_external_changes_created,
      lastImpactsCreated: row.last_impacts_created,
      isRunning: row.is_running === true,
    };
  });
});
