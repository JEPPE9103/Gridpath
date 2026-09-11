"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { TechnicalDetails } from "@/components/ui/workspace";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { SourceHealthView } from "@/lib/data/source-health";

export function SourceHealthSection({
  sources,
  showOperatorDetail = false,
}: {
  sources: SourceHealthView[];
  showOperatorDetail?: boolean;
}) {
  return (
    <section className="max-w-3xl rounded-md border border-line bg-surface p-5">
      <h2 className="text-base font-semibold">Data sources</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Status of supported official sources used by Development Intelligence. Available means the
        last successful ingest is within the expected cadence. Degraded means stale or failed.
        Not configured means no successful ingest yet. This is not real-time grid monitoring, and
        it does not mean available connection capacity.
      </p>
      {sources.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Source health is unavailable"
            description="Official source status will appear here after Monitor tables are applied."
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {sources.map((source) => (
            <li key={source.sourceId} className="rounded-md border border-line bg-canvas p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{source.name}</p>
                  {source.publisher ? (
                    <p className="text-xs text-muted">{source.publisher}</p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    source.isRunning && "bg-info-bg text-info",
                    !source.isRunning && source.health === "healthy" && "bg-success-bg text-success",
                    !source.isRunning &&
                      (source.health === "stale" || source.health === "failed") &&
                      "bg-warning-bg text-warning",
                    !source.isRunning && source.health === "never_ingested" && "bg-canvas text-muted",
                  )}
                >
                  {source.isRunning ? "Refresh running" : source.healthLabel}
                </span>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                {source.health === "failed" ? (
                  <HealthRow label="Condition" value="Last refresh failed" />
                ) : source.health === "stale" ? (
                  <HealthRow label="Condition" value="Ingest is older than the expected cadence" />
                ) : source.health === "never_ingested" ? (
                  <HealthRow label="Condition" value="Not configured / never ingested" />
                ) : (
                  <HealthRow label="Condition" value="Last successful ingest is current" />
                )}
              </dl>
              <TechnicalDetails summary="Technical details">
              <dl className="grid gap-2 sm:grid-cols-2">
                <HealthRow label="Last attempt" value={formatMaybe(source.lastAttemptAt)} />
                <HealthRow
                  label="Last successful full ingest"
                  value={formatMaybe(source.lastFullIngestAt ?? source.lastSuccessAt)}
                />
                <HealthRow
                  label="Latest successful snapshot"
                  value={formatMaybe(source.lastSnapshotAt)}
                />
                <HealthRow
                  label="Last detected published change"
                  value={formatMaybe(source.lastSourceChangeAt)}
                />
                <HealthRow
                  label="Noxheim check cadence"
                  value={`Every ${source.refreshIntervalHours} hours (Noxheim interval, not Ei publication frequency)`}
                />
                <HealthRow label="Next eligible refresh" value={formatMaybe(source.nextEligibleAt)} />
                {source.lastObservationsProcessed != null ? (
                  <HealthRow
                    label="Observations processed (last run)"
                    value={String(source.lastObservationsProcessed)}
                  />
                ) : null}
                {source.lastExternalChangesCreated != null ? (
                  <HealthRow
                    label="External changes created (last run)"
                    value={String(source.lastExternalChangesCreated)}
                  />
                ) : null}
                {source.lastImpactsCreated != null ? (
                  <HealthRow
                    label="Project impacts created (last run)"
                    value={String(source.lastImpactsCreated)}
                  />
                ) : null}
              </dl>
              </TechnicalDetails>
              <p className="mt-3 text-xs leading-5 text-muted">{source.changeLabel}</p>
              {source.slug === "nv-nmd-2023" ? (
                <p className="mt-2 text-xs leading-5 text-muted">
                  NMD 2023 source resolution is 10 m. Discovery stores 1 km majority class. Detailed
                  screening uses ingested composition tiles (target 50 m, cap 100 m) — not native 10 m
                  cells.
                </p>
              ) : null}
              {source.slug === "lantmateriet-dtm-1m" && source.health === "never_ingested" ? (
                <p className="mt-2 text-xs leading-5 text-muted">
                  Lantmäteriet detailed terrain provider not configured. Copernicus GLO-90 remains the
                  coarse discovery fallback.
                </p>
              ) : null}
              {source.slug === "svk-indicative-transmission-2026" ? (
                <p className="mt-2 text-xs leading-5 text-muted">
                  Official Indicative Transmission Context is blocked until a production-safe structured
                  source exists. NOXHEIM does not estimate project-level grid capacity.
                </p>
              ) : null}
              {source.lastAttemptFailed ? (
                <p className="mt-2 text-xs text-muted">
                  The last refresh failed. Previous successful official data is kept.{" "}
                  {showOperatorDetail
                    ? "See operator run history for the sanitized error code."
                    : "Noxheim will retry on the next scheduled check."}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs leading-5 text-muted">
        Local-network concessions are refreshed for geography and source health. V1 does not create
        project change alerts from concession geometry.
      </p>
    </section>
  );
}

function HealthRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function formatMaybe(value: string | null): string {
  if (!value) return "—";
  return formatDateTime(value);
}
