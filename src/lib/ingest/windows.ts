import type { IngestWindowOutcome } from "@/lib/ingest/coverage-keys";
import type { SearchBbox } from "@/lib/opportunities/spatial-screening";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ClaimedWindow = {
  outcome: IngestWindowOutcome;
  lockedUntil?: string | null;
};

export async function claimIngestWindow(
  service: SupabaseClient,
  sourceSlug: string,
  coverageKey: string,
  bbox: SearchBbox,
): Promise<ClaimedWindow> {
  const { data, error } = await service.rpc("claim_official_ingest_window", {
    p_source_slug: sourceSlug,
    p_coverage_key: coverageKey,
    p_west: bbox.west,
    p_south: bbox.south,
    p_east: bbox.east,
    p_north: bbox.north,
    p_lock_seconds: 900,
  });
  if (error) throw new Error(error.message);
  const row = data as { outcome?: string; window?: { locked_until?: string } } | null;
  const outcome = row?.outcome;
  if (outcome === "acquired" || outcome === "covered" || outcome === "waiting") {
    return { outcome, lockedUntil: row?.window?.locked_until ?? null };
  }
  return { outcome: "waiting" };
}

export async function finishIngestWindow(
  service: SupabaseClient,
  sourceSlug: string,
  coverageKey: string,
  status: "covered" | "partial" | "failed" | "missing" | "stale",
  options?: { sourceVersion?: string; snapshotId?: string | null; error?: string | null },
): Promise<void> {
  const { error } = await service.rpc("finish_official_ingest_window", {
    p_source_slug: sourceSlug,
    p_coverage_key: coverageKey,
    p_status: status,
    p_source_version: options?.sourceVersion ?? null,
    p_snapshot_id: options?.snapshotId ?? null,
    p_error: options?.error ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function waitForWindow(
  service: SupabaseClient,
  sourceSlug: string,
  coverageKey: string,
  bbox: SearchBbox,
  timeoutMs = 120_000,
): Promise<ClaimedWindow> {
  const started = Date.now();
  let delay = 750;
  while (Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    const claimed = await claimIngestWindow(service, sourceSlug, coverageKey, bbox);
    if (claimed.outcome !== "waiting") return claimed;
    delay = Math.min(delay * 1.4, 4_000);
  }
  return { outcome: "waiting" };
}
