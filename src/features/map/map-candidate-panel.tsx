"use client";

import { Button } from "@/components/ui/button";
import type { OpportunityRunCandidate } from "@/lib/data/opportunity-runs";
import {
  buildEvidenceCoverage,
  candidateToEvidenceInput,
  networkCoveringCopy,
  screeningFootprintQuality,
  whyCandidateRanks,
} from "@/lib/opportunities/evidence-coverage";
import { opportunityRecommendationLabel } from "@/lib/opportunities/catalog";
import { X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function MapCandidatePanel({
  candidate,
  searchId,
  runId,
  providerAvailability,
  onClose,
}: {
  candidate: OpportunityRunCandidate;
  searchId: string;
  runId: string;
  providerAvailability: Record<string, boolean>;
  onClose: () => void;
}) {
  const coverage = buildEvidenceCoverage(candidateToEvidenceInput(candidate, { providerAvailability }));
  const footprint = screeningFootprintQuality(candidate.geometryQuality, candidate.geometryQualityReason);
  const covering = networkCoveringCopy({
    localName: candidate.localCoveringName,
    nupName: candidate.nupCoveringName,
    queried: candidate.coveringQueried,
  });
  const area = candidate.contiguousAreaHa ?? candidate.usableAreaHa ?? candidate.grossAreaHa;
  const reasons = whyCandidateRanks(candidate);

  return (
    <aside className="absolute inset-x-3 bottom-3 max-h-[58%] overflow-auto rounded-md border border-line bg-surface p-4 md:inset-x-auto md:bottom-auto md:right-3 md:top-3 md:max-h-[calc(100%-1.5rem)] md:w-[320px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted">Candidate Site · Noxheim Derived</p>
          <h2 className="text-base font-semibold">{candidate.name}</h2>
        </div>
        <button type="button" onClick={onClose} className="text-muted hover:text-ink" aria-label="Close candidate panel">
          <X size={14} />
        </button>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <Line label="Area" value={area != null ? `${Math.round(area)} ha` : "—"} />
        <Line label="Recommendation" value={opportunityRecommendationLabel(candidate.recommendation)} />
        <Line label="Evidence Coverage" value={`${coverage.evaluatedCount}/${coverage.totalCount}`} />
        <Line label="Missing categories" value={coverage.missingLabels.length ? coverage.missingLabels.join(", ") : "None on evaluated set"} />
        <Line label="Footprint quality" value={footprint.label} />
        <Line label="Network covering" value={covering.title} />
      </dl>
      {reasons.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium">Why it ranks</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-3 text-[11px] leading-4 text-muted">
        Ranking is investigation order, not an official verdict. {covering.note} Screening geometry is not a
        parcel, approved site, or constructable footprint.
      </p>
      <Link href={`/opportunities/searches/${searchId}/runs/${runId}`} className="mt-4 block">
        <Button className="w-full">Open screening results</Button>
      </Link>
    </aside>
  );
}

function Line({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
