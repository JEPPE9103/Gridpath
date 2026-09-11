"use client";

import type { OfficialLoadStatus } from "@/lib/data/official-map";
import type { OfficialSpatialSummary } from "@/lib/domain/official-map";

export function MapSpatialSummary({
  summary,
  unmatchedActive,
  onToggleUnmatched,
  matchesStatus = "available",
  localNetworkStatus = "available",
}: {
  summary: OfficialSpatialSummary;
  unmatchedActive: boolean;
  onToggleUnmatched: () => void;
  matchesStatus?: OfficialLoadStatus;
  localNetworkStatus?: OfficialLoadStatus;
}) {
  const degraded = matchesStatus === "unavailable" || localNetworkStatus === "unavailable";
  return (
    <section className="rounded-md border border-line bg-canvas p-2.5 text-xs">
      <p className="font-medium">Official grid context</p>
      {degraded ? (
        <p className="mt-2 text-sm text-ink" data-testid="map-official-degraded">
          Official source unavailable. This is not a no-match result.
        </p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          <li>{summary.activeProjects} active projects</li>
          <li>{summary.localMatched} matched to official local-network context</li>
          <li>{summary.nupMatched} matched to NUP context</li>
          <li>{summary.unmatched} unmatched / review</li>
        </ul>
      )}
      <button
        type="button"
        onClick={onToggleUnmatched}
        aria-pressed={unmatchedActive}
        className="mt-2 text-sm font-medium text-teal hover:underline"
      >
        {unmatchedActive ? "Show all mapped projects" : "Show unmatched / review"}
      </button>
      <p className="mt-2 text-[11px] leading-4 text-muted">
        Match counts are covering geography only. This is not a grid score or available connection capacity.
      </p>
    </section>
  );
}
