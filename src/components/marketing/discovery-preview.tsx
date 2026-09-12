"use client";

import { AppFrame } from "@/components/marketing/app-frame";
import { DeferredDiscoveryMap } from "@/components/marketing/deferred-discovery-map";
import { EvidenceStateMark, ProvenanceChip } from "@/components/marketing/provenance-chips";
import { SAMPLE_EVIDENCE_COVERAGE, SAMPLE_SELECTED_CANDIDATE } from "@/lib/demo/sample-discovery-preview";

export function DiscoveryPreview() {
  const site = SAMPLE_SELECTED_CANDIDATE;

  return (
    <AppFrame path="/opportunities">
      <div className="min-h-[280px] bg-canvas sm:min-h-[360px]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-3 py-2.5">
          <p className="text-[11px] text-muted">
            <span className="font-semibold text-ink">Search Area</span> → Candidate Sites
          </p>
          <p className="text-[11px] text-muted">
            <span className="font-semibold text-ink">3</span> Candidate Sites
          </p>
          <p className="text-[11px] text-muted">
            <span className="font-semibold text-ink">{SAMPLE_EVIDENCE_COVERAGE.summary}</span>
          </p>
        </div>
        <div className="relative">
          <DeferredDiscoveryMap eager size="hero" />
          <div className="p-3 sm:absolute sm:bottom-3 sm:left-3 sm:w-[268px] sm:p-0">
            <SelectedCandidateCard />
          </div>
        </div>
      </div>
      <p className="sr-only">
        Sample Search Area with three Candidate Sites. Selected {site.name}, {site.recommendation}.{" "}
        {SAMPLE_EVIDENCE_COVERAGE.summary}. Ranking is Noxheim derived, not an official verdict.
      </p>
    </AppFrame>
  );
}

function SelectedCandidateCard() {
  const site = SAMPLE_SELECTED_CANDIDATE;

  return (
    <article className="rounded-lg border border-line/80 bg-surface/92 p-3 shadow-[0_18px_36px_-22px_rgba(26,30,36,0.5)] backdrop-blur-[8px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted">Selected Candidate Site</p>
          <p className="mt-1 text-sm font-semibold leading-5">
            #{site.rank} {site.name}
          </p>
        </div>
        <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
          Sample
        </span>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-ink">{site.recommendation}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ProvenanceChip label="Noxheim Derived" />
        <EvidenceStateMark state="evaluated" />
      </div>
      <dl className="mt-3 space-y-1 text-[11px]">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Evidence</dt>
          <dd className="font-medium">{site.evidenceSummary}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Network area</dt>
          <dd className="text-right font-medium">Ei covering</dd>
        </div>
      </dl>
    </article>
  );
}
