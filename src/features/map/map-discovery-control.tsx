"use client";

import { formatDate } from "@/lib/format";
import {
  discoveryGeographyLabel,
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
  return (
    <div className="flex min-w-[16rem] flex-col" data-testid="map-discovery">
      <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2 text-sm">
        <span className="whitespace-nowrap text-muted">Discovery</span>
        {searches.length === 0 ? (
          <span className="text-ink">No searches yet</span>
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
            className="max-w-[18rem] bg-transparent text-ink"
          >
            <option value="">No run selected</option>
            {searches.map((search) => (
              <option
                key={search.searchId}
                value={search.searchId}
                disabled={!isCompletedDiscoveryRun(search.latestRunStatus) || !search.latestRunId}
              >
                {search.name} · {discoveryRunStatusLabel(search.latestRunStatus)} · {formatDate(search.createdAt)}
              </option>
            ))}
          </select>
        )}
      </label>
      {searches.length === 0 ? (
        <p className="mt-1 text-[11px] leading-4 text-muted">
          Start by searching a development area.{" "}
          <Link href="/opportunities/new" className="font-medium text-teal hover:underline">
            New search
          </Link>
        </p>
      ) : (
        <p className="mt-1 text-[11px] leading-4 text-muted">
          {selectedSearch
            ? discoveryGeographyLabel(selectedSearch)
            : "Select a completed screening run to load Candidate Sites."}
        </p>
      )}
      {error ? <p className="mt-1 text-[11px] leading-4 text-critical">{error}</p> : null}
    </div>
  );
}
