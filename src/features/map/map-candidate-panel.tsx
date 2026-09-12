"use client";

import { Button } from "@/components/ui/button";
import type { OpportunityRunCandidate } from "@/lib/data/opportunity-runs";
import {
  buildEvidenceCoverage,
  candidateToEvidenceInput,
  networkCoveringCopy,
  screeningFootprintQuality,
} from "@/lib/opportunities/evidence-coverage";
import {
  buildCandidateIntelligence,
  intelligenceCriteriaForTechnology,
  intelligenceHeadline,
} from "@/lib/opportunities/candidate-intelligence";
import { opportunityRecommendationLabel } from "@/lib/opportunities/catalog";
import { CandidateIntelligenceBlock } from "@/features/opportunities/candidate-intelligence-block";
import { MapFact, MapObjectPanel, MapPanelNote } from "@/features/map/map-object-panel";
import Link from "next/link";

export function MapCandidatePanel({
  candidate,
  searchId,
  runId,
  providerAvailability,
  technology = "battery_storage",
  searchCriteria = null,
  onClose,
}: {
  candidate: OpportunityRunCandidate;
  searchId: string;
  runId: string;
  providerAvailability: Record<string, boolean>;
  technology?: string;
  searchCriteria?: {
    maxSlopeDegrees: number | null;
    slopeMode: "preference" | "hard";
    maxRoadDistanceM: number | null;
    roadMode: "preference" | "hard";
    excludeProtected: boolean;
    excludeNatura: boolean;
  } | null;
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
  const intelligence = buildCandidateIntelligence(
    candidate,
    intelligenceCriteriaForTechnology(technology, searchCriteria),
  );
  const next = intelligence.nextInvestigations[0];

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
        <MapFact label="Area" value={area != null ? `${area.toFixed(2)} ha` : "—"} />
        <MapFact label="Recommendation" value={opportunityRecommendationLabel(candidate.recommendation)} />
        <MapFact label="Evidence Coverage" value={`${coverage.evaluatedCount}/${coverage.totalCount}`} />
        <MapFact
          label="Missing"
          value={coverage.missingLabels.length ? coverage.missingLabels.join(", ") : "None on evaluated set"}
        />
        <MapFact label="Footprint quality" value={footprint.label} />
        <MapFact label="Network covering" value={covering.title} />
        <MapFact
          label="Road proximity"
          value={
            candidate.roadQueried && candidate.roadDistanceM != null
              ? candidate.roadDistanceM < 10
                ? "Intersects official RoadLink"
                : `${Math.round(candidate.roadDistanceM)} m to official RoadLink`
              : "Not evaluated"
          }
        />
        <MapFact label="Constraints" value={intelligenceHeadline(intelligence)} />
        <MapFact label="Next investigation" value={next ? next.action : "None generated"} />
      </dl>
      <div className="mt-3">
        <CandidateIntelligenceBlock intelligence={intelligence} compact />
      </div>
      <MapPanelNote>
        Ranking is investigation order, not an official verdict. {covering.note} Screening geometry is not a
        parcel, approved site, or constructable footprint.
      </MapPanelNote>
    </MapObjectPanel>
  );
}
