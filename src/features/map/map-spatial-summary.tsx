"use client";

import type { OfficialSpatialSummary } from "@/lib/domain/official-map";

export function MapSpatialSummary({
  summary,
  unmatchedActive,
  onToggleUnmatched,
}: {
  summary: OfficialSpatialSummary;
  unmatchedActive: boolean;
  onToggleUnmatched: () => void;
}) {
  return (
    <section className="rounded-md border border-line bg-surface/95 p-3 text-xs backdrop-blur-sm">
      <p className="font-medium">Official grid context</p>
      <ul className="mt-2 space-y-1 text-sm">
        <li>{summary.activeProjects} active projects</li>
        <li>{summary.localMatched} matched to official local-network context</li>
        <li>{summary.nupMatched} matched to NUP context</li>
        <li>{summary.unmatched} unmatched / review</li>
      </ul>
      <button
        type="button"
        onClick={onToggleUnmatched}
        className="mt-2 text-sm font-medium text-teal hover:underline"
      >
        {unmatchedActive ? "Show all mapped projects" : "Show unmatched / review"}
      </button>
      <p className="mt-2 text-[11px] leading-4 text-muted">
        Match counts are covering geography only. This is not a grid score or capacity rating.
      </p>
    </section>
  );
}
