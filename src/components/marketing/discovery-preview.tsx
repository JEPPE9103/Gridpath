"use client";

import { AppFrame } from "@/components/marketing/app-frame";
import { DeferredDiscoveryMap } from "@/components/marketing/deferred-discovery-map";
import { EvidenceStateMark, ProvenanceChip } from "@/components/marketing/provenance-chips";
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
          <p className="text-[11px] text-muted">
            <span className="font-semibold text-ink">{SAMPLE_EVIDENCE_COVERAGE.summary}</span>
          </p>
        </div>
        <div className="relative">
          <DeferredDiscoveryMap eager size="hero" />
          <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-auto sm:w-[300px]">
            <SelectedCandidateCard />
          </div>
        </div>
      </div>
      <p className="sr-only">
        Sample Search Area with three Candidate Sites. Selected {site.name}, {site.recommendation}.{" "}
        {SAMPLE_EVIDENCE_COVERAGE.summary}. Why: {site.whyThisSite}. Top unknown: {site.topUnknown}.
        Ranking is Noxheim derived, not an official verdict.
      </p>
    </AppFrame>
  );
}

function SelectedCandidateCard() {
  const site = SAMPLE_SELECTED_CANDIDATE;

  return (
    <article className="max-h-[210px] overflow-hidden rounded-lg border border-line/80 bg-surface/92 p-2.5 shadow-[0_18px_36px_-22px_rgba(26,30,36,0.5)] backdrop-blur-[8px] sm:max-h-none sm:overflow-visible sm:p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
            Candidate Intelligence
          </p>
          <p className="mt-1 text-sm font-semibold leading-5">
            #{site.rank} {site.name}
          </p>
        </div>
        <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
          Sample
        </span>
      </div>
      <p className="mt-1.5 hidden text-[12px] leading-5 text-ink sm:mt-2 sm:block">{site.recommendation}</p>
      <div className="mt-1.5 hidden flex-wrap items-center gap-2 sm:mt-2 sm:flex">
        <ProvenanceChip label="Noxheim Derived" />
        <EvidenceStateMark state="evaluated" />
      </div>
      <dl className="mt-2 space-y-1 text-[11px] sm:mt-2.5 sm:space-y-1.5">
        <div className="hidden sm:block">
          <dt className="text-muted">Why this site</dt>
          <dd className="mt-0.5 font-medium leading-4 text-ink">{site.whyThisSite}</dd>
        </div>
        <div>
          <dt className="text-muted">Top constraint</dt>
          <dd className="mt-0.5 line-clamp-2 font-medium leading-4 text-ink">{site.topConstraint}</dd>
        </div>
        <div>
          <dt className="text-muted">Top unknown</dt>
          <dd className="mt-0.5 line-clamp-2 font-medium leading-4 text-ink">{site.topUnknown}</dd>
        </div>
        <div>
          <dt className="text-muted">Recommended next</dt>
          <dd className="mt-0.5 line-clamp-2 font-medium leading-4 text-ink">{site.recommendedNext}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-line/60 pt-1.5">
          <dt className="text-muted">Evidence</dt>
          <dd className="font-medium">{site.evidenceSummary}</dd>
        </div>
      </dl>
    </article>
  );
}
