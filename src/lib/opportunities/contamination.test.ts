import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCandidateIntelligence, parseFrozenIntelligence } from "./candidate-intelligence";
import { deriveCandidateConstraints, hasBlocker } from "./constraints";
import { opportunityCopyContainsForbiddenTerm } from "./copy";
import {
  CONTAMINATION_NEARBY_M,
  describeContaminationEvidence,
  isHighOfficialRiskClass,
} from "./contamination";
import { deriveNextInvestigations } from "./investigations";
import { suitabilityScoreV4 } from "./run-ranking";
import type { ScreeningCriteria } from "./screening";
import { evaluateOpportunityScreening } from "./screening";

const BASE = {
  excluded: false,
  exclusionReason: null,
  geometryQuality: "pass" as const,
  geometryQualityReason: null,
  terrainQueried: true,
  meanSlopeDeg: 2.4,
  p90SlopeDeg: 3.1,
  pctBelowSlope: 92,
  terrainResolution: "coarse",
  maxSlopeDegrees: 5,
  slopeMode: "preference" as const,
  roadQueried: true,
  roadDistanceM: 120,
  roadClass: "primary",
  maxRoadDistanceM: 1000,
  roadMode: "preference" as const,
  landCoverQueried: true,
  protectedQueried: true,
  naturaQueried: true,
  excludeProtected: true,
  excludeNatura: true,
  coveringQueried: true,
  localCoveringName: "E.ON Energidistribution",
  nupCoveringName: "SE3 plan",
  floodQueried: true,
  floodOverlapPct: 0,
  floodOverlapHa: 0,
  floodClasses: [] as string[],
  floodMode: "preference" as const,
  floodHardExclusionPct: 1,
  floodRiskOverlapPct: 1,
  floodMajorRiskOverlapPct: 10,
  groundQueried: true,
  groundComposition: { TILL: 100 } as Record<string, number>,
  groundDominantGroup: "TILL",
  groundSourceClasses: ["Morän"],
  groundMode: "preference" as const,
  contaminationQueried: true,
  contaminationIntersectingCount: 0,
  contaminationNearbyCount: 0,
  contaminationNearestM: null as number | null,
  contaminationRiskClasses: [] as string[],
  contaminationStatuses: [] as string[],
  contaminationRecordIds: [] as string[],
  contaminationMode: "preference" as const,
};

describe("contamination / environmental history intelligence", () => {
  it("treats evaluated zero records as INFO, never environmentally-safe language", () => {
    const constraints = deriveCandidateConstraints(BASE);
    const row = constraints.find((item) => item.id === "contamination_no_mapped_records");
    assert.equal(row?.severity, "info");
    assert.match(row?.explanation ?? "", /not a finding that environmental history is absent/i);
    assert.equal(opportunityCopyContainsForbiddenTerm(row?.explanation ?? ""), null);
    assert.equal(opportunityCopyContainsForbiddenTerm("environmentally safe site"), "environmentally safe");
    assert.equal(opportunityCopyContainsForbiddenTerm("contaminated land confirmed"), "contaminated land confirmed");
  });

  it("maps nearby records to RISK and intersecting high official class to MAJOR_RISK", () => {
    const nearby = deriveCandidateConstraints({
      ...BASE,
      contaminationNearbyCount: 2,
      contaminationNearestM: 90,
    }).find((item) => item.id === "contamination_nearby_record");
    assert.equal(nearby?.severity, "risk");
    assert.match(nearby?.measuredValue ?? "", new RegExp(`${CONTAMINATION_NEARBY_M}`));

    const major = deriveCandidateConstraints({
      ...BASE,
      contaminationIntersectingCount: 1,
      contaminationNearestM: 0,
      contaminationRiskClasses: ["Riskklass 2"],
    }).find((item) => item.id === "contamination_high_risk_intersecting");
    assert.equal(major?.severity, "major_risk");
    assert.equal(isHighOfficialRiskClass("Riskklass 2"), true);
  });

  it("never defaults intersecting records to BLOCKER; hard mode can", () => {
    const preference = deriveCandidateConstraints({
      ...BASE,
      contaminationIntersectingCount: 1,
      contaminationMode: "preference",
    });
    assert.equal(hasBlocker(preference), false);
    assert.ok(preference.some((item) => item.id === "contamination_intersecting_record"));

    const hard = deriveCandidateConstraints({
      ...BASE,
      contaminationIntersectingCount: 1,
      contaminationMode: "hard",
    });
    assert.ok(hard.some((item) => item.id === "contamination_hard_exclusion" && item.severity === "blocker"));
  });

  it("marks missing evidence as UNKNOWN and plans investigation", () => {
    const constraints = deriveCandidateConstraints({
      ...BASE,
      contaminationQueried: false,
      contaminationIntersectingCount: null,
      contaminationNearbyCount: null,
    });
    const missing = constraints.find((item) => item.id === "contamination_unavailable");
    assert.equal(missing?.severity, "unknown");
    const next = deriveNextInvestigations(constraints);
    assert.ok(next.some((item) => item.id === "investigate_contamination_unavailable"));
    assert.match(
      next.find((item) => item.id === "investigate_contamination_unavailable")?.action ?? "",
      /Obtain contamination\/environmental-history/,
    );
  });

  it("plans NOW investigation for intersecting official records", () => {
    const constraints = deriveCandidateConstraints({
      ...BASE,
      contaminationIntersectingCount: 1,
      contaminationNearestM: 0,
    });
    const next = deriveNextInvestigations(constraints);
    const row = next.find(
      (item) =>
        item.constraintId === "contamination_intersecting_record" ||
        item.constraintId === "contamination_high_risk_intersecting",
    );
    assert.equal(row?.priority, "now");
    assert.match(row?.action ?? "", /Review environmental history/);
  });

  it("describes evidence without claiming confirmed contamination", () => {
    const text = describeContaminationEvidence({
      intersectingCount: 1,
      nearbyCount: 0,
      nearestM: 0,
      riskClasses: ["Riskklass 2"],
    });
    assert.match(text, /intersects the Candidate footprint/i);
    assert.match(text, /not a contamination confirmation/i);
    assert.equal(opportunityCopyContainsForbiddenTerm(text), null);
  });

  it("does not let missing contamination evidence improve suitability score", () => {
    const criteria: ScreeningCriteria = {
      technology: "battery_storage",
      country: "SE",
      region: null,
      municipality: null,
      targetMw: null,
      targetMwh: null,
      minSiteAreaHa: 8,
      maxDistanceKm: null,
      excludeProtected: true,
      excludeNatura: true,
      maxSlopePercent: null,
      minDistanceResidentialM: null,
      electricityArea: null,
      notes: null,
      contaminationMode: "preference",
    };
    const baseRow = {
      id: "1",
      name: "A",
      latitude: 59,
      longitude: 15,
      gross_area_ha: 12,
      usable_area_ha: 12,
      contiguous_area_ha: 12,
      protected_overlap_pct: 0,
      natura_overlap_pct: 0,
      protected_names: [],
      natura_names: [],
      local_covering_name: "Op",
      nup_covering_name: null,
      covering_queried: true,
      protected_queried: true,
      natura_queried: true,
      terrain_queried: true,
      pct_below_slope: 90,
      land_cover_queried: true,
      land_cover: { open: 80 },
      road_queried: true,
      road_distance_m: 100,
      flood_queried: true,
      flood_overlap_pct: 0,
      ground_queried: true,
      ground_composition: { TILL: 100 },
      contamination_queried: true,
      contamination_intersecting_count: 0,
      contamination_nearby_count: 0,
      target_fit_score: 0.9,
      geometry_quality: "pass",
    };
    const screening = evaluateOpportunityScreening({
      criteria,
      candidate: {
        name: "A",
        country: "SE",
        region: null,
        municipality: null,
        latitude: 59,
        longitude: 15,
        targetMw: null,
        targetMwh: null,
        siteAreaHa: 12,
        usableAreaHa: 12,
        technology: "battery_storage",
        covering: {
          queried: true,
          localCovered: true,
          nupCovered: false,
          localName: "Op",
          nupName: null,
          retrievedAt: null,
          sourceName: null,
        },
      },
    });
    const evaluated = suitabilityScoreV4(baseRow, screening, criteria);
    const missing = suitabilityScoreV4(
      { ...baseRow, contamination_queried: false, contamination_intersecting_count: null },
      screening,
      criteria,
    );
    assert.ok(missing <= evaluated);
  });

  it("freezes contamination constraints into Opportunity intelligence snapshot", () => {
    const intelligence = buildCandidateIntelligence({
      ...BASE,
      contaminationIntersectingCount: 1,
      contaminationNearestM: 0,
      contaminationRiskClasses: ["Riskklass 1"],
      keyPositive: null,
      keyRisk: null,
      targetFitLabel: null,
      targetFitScore: 1,
      protectedOverlapPct: 0,
      naturaOverlapPct: 0,
      landCover: { open: 100 },
      maxRoadDistanceM: 1000,
    });
    const frozen = parseFrozenIntelligence({ intelligence });
    assert.ok(
      frozen?.constraints.some(
        (item) =>
          item.id === "contamination_high_risk_intersecting" || item.id === "contamination_intersecting_record",
      ),
    );
  });
});
