"use client";

import {
  discoveryRunStatusLabel,
  isCompletedDiscoveryRun,
  type MapDiscoverySearch,
} from "@/lib/domain/map-discovery";
import Link from "next/link";

export function MapDiscoveryControl({
  searches,
  selectedRunId,
  loading,
  error,
  onSelect,
  onClear,
}: {
  searches: MapDiscoverySearch[];
  selectedRunId: string | null;
  loading: boolean;
  error: string | null;
  onSelect: (search: MapDiscoverySearch) => void;
  onClear: () => void;
}) {
  const selectedSearch = searches.find((item) => item.latestRunId === selectedRunId) ?? null;
  const candidateCount = selectedSearch?.returnedCount;
  const status = selectedSearch ? discoveryRunStatusLabel(selectedSearch.latestRunStatus) : null;
  return (
    <div className="flex min-w-0 items-center gap-2 overflow-hidden" data-testid="map-discovery">
      <label className="flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2 text-sm">
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
          Discovery
        </span>
        {searches.length === 0 ? (
          <span className="pr-1 text-ink">No searches yet</span>
        ) : (
          <select
            value={selectedSearch?.searchId ?? ""}
            disabled={loading}
            aria-label="Selected screening run"
            onChange={(event) => {
              const value = event.target.value;
              if (!value) {
                onClear();
                return;
              }
              const search = searches.find((item) => item.searchId === value);
              if (search) onSelect(search);
            }}
            className="max-w-[14rem] bg-transparent text-ink lg:max-w-[18rem]"
          >
            <option value="">Select a run</option>
            {searches.map((search) => (
              <option
                key={search.searchId}
                value={search.searchId}
                disabled={!isCompletedDiscoveryRun(search.latestRunStatus) || !search.latestRunId}
              >
                {search.name}
              </option>
            ))}
          </select>
        )}
      </label>
      {selectedSearch && isCompletedDiscoveryRun(selectedSearch.latestRunStatus) ? (
        <>
          <span className="hidden whitespace-nowrap text-[11px] text-muted 2xl:inline">
            {candidateCount != null ? `${candidateCount} Candidate Sites` : "Candidate Sites"}
            {status ? ` · ${status.toLowerCase()}` : ""}
          </span>
          {selectedSearch.latestRunId ? (
            <Link
              href={`/opportunities/searches/${selectedSearch.searchId}/runs/${selectedSearch.latestRunId}`}
              className="hidden whitespace-nowrap text-[11px] font-medium text-teal hover:underline xl:inline"
            >
              View results →
            </Link>
          ) : null}
        </>
      ) : null}
      {error ? <p className="max-w-[12rem] truncate text-[11px] text-critical">{error}</p> : null}
    </div>
  );
}
