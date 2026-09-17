"use client";

import { AppFrame } from "@/components/marketing/app-frame";
import { DeferredDiscoveryMap } from "@/components/marketing/deferred-discovery-map";
import {
  SAMPLE_EVIDENCE_COVERAGE,
  SAMPLE_SELECTED_CANDIDATE,
} from "@/lib/demo/sample-discovery-preview";

export function DiscoveryPreview() {
  const site = SAMPLE_SELECTED_CANDIDATE;

  return (
    <AppFrame path="/opportunities">
      <div className="bg-canvas">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-3 py-2">
          <p className="text-[11px] text-muted">
            <span className="font-semibold text-ink">Search Area</span> → Candidate Sites
          </p>
          <p className="hidden text-[11px] text-muted sm:block">
            <span className="font-semibold text-ink">3</span> Candidate Sites
          </p>
          <span className="ml-auto text-[10px] uppercase tracking-wide text-muted sm:ml-0">
            Sample
          </span>
        </div>
        <div className="relative">
          <DeferredDiscoveryMap eager size="hero" />
          {/* Desktop: compact summary — leaves map geography readable */}
          <div className="pointer-events-none absolute bottom-3 right-3 z-10 hidden w-[min(280px,calc(100%-1.5rem))] lg:block">
            <HeroIntelligenceSummary />
          </div>
        </div>
        {/* Mobile: stack below map so the geography stays legible */}
        <div className="border-t border-line p-3 lg:hidden">
          <HeroIntelligenceSummary />
        </div>
      </div>
      <p className="sr-only">
        Sample Search Area with three Candidate Sites. Selected {site.name}, {site.recommendation}.{" "}
        {SAMPLE_EVIDENCE_COVERAGE.summary}. Top unknown: {site.topUnknown}. Recommended next:{" "}
        {site.recommendedNext}. Ranking is Noxheim derived, not an official verdict.
      </p>
    </AppFrame>
  );
}

/**
 * Compact hero summary only — detailed Candidate Intelligence lives in its own section.
 * Counts derived from sample evidence coverage + selected candidate fields.
 */
function HeroIntelligenceSummary() {
  const site = SAMPLE_SELECTED_CANDIDATE;
  const unknownCount = SAMPLE_EVIDENCE_COVERAGE.items.filter(
    (item) => item.state === "not_evaluated" || item.state === "insufficient",
  ).length;
  const constraintCount = site.topConstraint ? 1 : 0;
  const recommendedNextShort = shortenRecommendedNext(site.recommendedNext);

  return (
    <article className="rounded-lg border border-line/80 bg-surface/95 p-3 shadow-[0_16px_32px_-24px_rgba(26,30,36,0.55)] backdrop-blur-[6px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Candidate Intelligence
          </p>
          <p className="mt-1 text-sm font-semibold leading-5 text-ink">
            #{site.rank} {site.name}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
          Sample
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-ink">{site.recommendation}</p>
      <p className="mt-2 text-[11px] text-muted">{site.evidenceSummary}</p>
      <p className="mt-1 text-[11px] text-muted">
        {constraintCount} constraint
        {constraintCount === 1 ? "" : "s"} · {unknownCount} unknown
        {unknownCount === 1 ? "" : "s"}
      </p>
      <div className="mt-3 border-t border-line/70 pt-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-teal">
          Recommended next
        </p>
        <p className="mt-1 text-[12px] font-medium leading-4 text-ink">{recommendedNextShort}</p>
      </div>
    </article>
  );
}

function shortenRecommendedNext(full: string): string {
  if (/surficial geology|ground|soil/i.test(full)) {
    return "Confirm ground conditions";
  }
  return full.length > 48 ? `${full.slice(0, 45).trimEnd()}…` : full;
}
