export type SourceHealthStatus = "healthy" | "stale" | "failed" | "never_ingested";

export type SourceHealthInput = {
  lastAttemptStatus: "running" | "success" | "failed" | "skipped" | null;
  lastAttemptSourceChanged: boolean | null;
  lastSuccessAt: Date | null;
  lastSnapshotAt: Date | null;
  refreshIntervalHours: number;
  now: Date;
  fullIngestRequired?: boolean;
};

/**
 * Stale threshold is 2× configured cadence after the last successful usable ingest.
 * Cache-only downloads and unchanged published content do not define freshness.
 * An older snapshot (last time published content changed) is not a delay by itself.
 */
export function deriveSourceHealth(input: SourceHealthInput): SourceHealthStatus {
  if (!input.lastSnapshotAt && !input.lastSuccessAt) {
    return "never_ingested";
  }
  if (input.lastAttemptStatus === "failed") {
    return "failed";
  }

  const freshnessAnchor = input.lastSuccessAt ?? input.lastSnapshotAt;
  if (!freshnessAnchor) {
    return "never_ingested";
  }

  const staleAfterMs = Math.max(24, input.refreshIntervalHours) * 2 * 60 * 60 * 1000;
  if (input.now.getTime() - freshnessAnchor.getTime() > staleAfterMs) {
    return "stale";
  }
  return "healthy";
}

export function sourceHealthLabel(status: SourceHealthStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "stale":
      return "Stale";
    case "failed":
      return "Failed";
    case "never_ingested":
      return "Never ingested";
  }
}

export function sourceChangeLabel(sourceChanged: boolean | null, status: string | null): string {
  if (status === "failed") {
    return "Last refresh failed";
  }
  if (sourceChanged === false && (status === "success" || status === "skipped")) {
    return "Source successfully refreshed; published content unchanged";
  }
  if (sourceChanged === true) {
    return "Published content appears to have changed";
  }
  return "—";
}
