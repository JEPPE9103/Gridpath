"use client";

import { EmptyState } from "@/components/ui/empty-state";
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
        Noxheim periodically refreshes supported official sources. A healthy source with unchanged
        published content is expected. Noxheim’s check cadence is not the same as Ei’s publication
        schedule. This is not real-time grid monitoring, and it does not mean available connection
        capacity.
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
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-ink">
                  {source.isRunning ? "Refresh running" : source.healthLabel}
                </span>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
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
              <p className="mt-3 text-xs leading-5 text-muted">{source.changeLabel}</p>
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
