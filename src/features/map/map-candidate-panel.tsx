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
import { MapFact, MapObjectPanel, MapPanelNote } from "@/features/map/map-object-panel";
import Link from "next/link";

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
    <MapObjectPanel
      kind="Candidate Site"
      provenance="Noxheim Derived"
      title={candidate.name}
      testId="map-candidate-panel"
      onClose={onClose}
      action={
        <Link href={`/opportunities/searches/${searchId}/runs/${runId}`}>
          <Button className="w-full">Open screening results</Button>
        </Link>
      }
    >
      <dl className="space-y-1.5">
        <MapFact label="Area" value={area != null ? `${Math.round(area)} ha` : "—"} />
        <MapFact label="Recommendation" value={opportunityRecommendationLabel(candidate.recommendation)} />
        <MapFact label="Evidence Coverage" value={`${coverage.evaluatedCount}/${coverage.totalCount}`} />
        <MapFact
          label="Missing"
          value={coverage.missingLabels.length ? coverage.missingLabels.join(", ") : "None on evaluated set"}
        />
        <MapFact label="Footprint quality" value={footprint.label} />
        <MapFact label="Network covering" value={covering.title} />
      </dl>
      {reasons.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium">Why this ranks</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <MapPanelNote>
        Ranking is investigation order, not an official verdict. {covering.note} Screening geometry is not a
        parcel, approved site, or constructable footprint.
      </MapPanelNote>
    </MapObjectPanel>
  );
}
