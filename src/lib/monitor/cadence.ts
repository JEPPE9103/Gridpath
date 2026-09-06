export type IngestionRunTrigger = "manual" | "scheduled";

export type SourceDueDecision = "due" | "not_due" | "retry_failed";

/** Probe-only successes must not satisfy full-ingest cadence. */
export function cadenceAnchorSuccessAt(input: {
  lastSuccessAt: Date | null;
  probeOnly?: boolean;
}): Date | null {
  if (!input.lastSuccessAt || input.probeOnly) {
    return null;
  }
  return input.lastSuccessAt;
}

export function isSourceRefreshDue(input: {
  trigger: IngestionRunTrigger;
  now: Date;
  lastSuccessAt: Date | null;
  lastAttemptStatus: "running" | "success" | "failed" | "skipped" | null;
  refreshIntervalHours: number;
  lastSuccessWasProbeOnly?: boolean;
}): SourceDueDecision {
  if (input.trigger === "manual") {
    return "due";
  }
  if (input.lastAttemptStatus === "failed") {
    return "retry_failed";
  }
  const lastSuccessAt = cadenceAnchorSuccessAt({
    lastSuccessAt: input.lastSuccessAt,
    probeOnly: input.lastSuccessWasProbeOnly,
  });
  if (!lastSuccessAt) {
    return "due";
  }
  const elapsedMs = input.now.getTime() - lastSuccessAt.getTime();
  const intervalMs = Math.max(24, input.refreshIntervalHours) * 60 * 60 * 1000;
  return elapsedMs >= intervalMs ? "due" : "not_due";
}

export function nextEligibleRefreshAt(input: {
  lastSuccessAt: Date | null;
  refreshIntervalHours: number;
}): Date {
  if (!input.lastSuccessAt) {
    return new Date(0);
  }
  return new Date(
    input.lastSuccessAt.getTime() + Math.max(24, input.refreshIntervalHours) * 60 * 60 * 1000,
  );
}
