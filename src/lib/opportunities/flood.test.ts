import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveCandidateConstraints, hasBlocker } from "./constraints";
import { deriveNextInvestigations } from "./investigations";
import { parseFrozenIntelligence } from "./candidate-intelligence";
import { opportunityCopyContainsForbiddenTerm } from "./copy";
import {
  FLOOD_HARD_EXCLUSION_PCT,
  FLOOD_MAJOR_RISK_OVERLAP_PCT,
  FLOOD_RISK_OVERLAP_PCT,
  describeFloodOverlap,
  formatFloodOverlapPct,
} from "./flood";
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
  floodHardExclusionPct: FLOOD_HARD_EXCLUSION_PCT,
  floodRiskOverlapPct: FLOOD_RISK_OVERLAP_PCT,
  floodMajorRiskOverlapPct: FLOOD_MAJOR_RISK_OVERLAP_PCT,
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
  contaminationMode: "preference" as const,
  planningQueried: true,
  planningIntersectingCount: 0,
  planningOverlapPct: 0,
  planningNearestM: null as number | null,
  planningPlanIds: [] as string[],
  planningPlanNames: [] as string[],
  planningPlanStatuses: [] as string[],
  planningMunicipality: null as string | null,
  planningProviderKey: null as string | null,
};

describe("flood / water intelligence", () => {
  it("reports no mapped overlap as INFO, never flood-safe language", () => {
    const constraints = deriveCandidateConstraints(BASE);
    const flood = constraints.find((item) => item.id === "flood_no_mapped_overlap");
    assert.equal(flood?.severity, "info");
    assert.match(flood?.explanation ?? "", /does not intersect|evaluated Search Area cache/i);
    assert.equal(opportunityCopyContainsForbiddenTerm(flood?.explanation ?? ""), null);
    assert.equal(opportunityCopyContainsForbiddenTerm(flood?.whyItMatters ?? ""), null);
    assert.equal(opportunityCopyContainsForbiddenTerm("flood safe site"), "flood safe");
  });

  it("maps edge overlap to RISK and material overlap to MAJOR_RISK", () => {
    const edge = deriveCandidateConstraints({ ...BASE, floodOverlapPct: 3 }).find(
      (item) => item.id === "flood_edge_overlap",
    );
    const major = deriveCandidateConstraints({ ...BASE, floodOverlapPct: 18 }).find(
      (item) => item.id === "flood_major_overlap",
    );
    assert.equal(edge?.severity, "risk");
    assert.equal(major?.severity, "major_risk");
    assert.match(major?.explanation ?? "", /18\.0%/);
  });

  it("uses BLOCKER only for hard exclusion profile", () => {
    const preference = deriveCandidateConstraints({ ...BASE, floodOverlapPct: 25, floodMode: "preference" });
    assert.equal(hasBlocker(preference), false);
    const hard = deriveCandidateConstraints({
      ...BASE,
      floodOverlapPct: 25,
      floodMode: "hard",
      floodHardExclusionPct: 1,
    });
    assert.equal(hasBlocker(hard), true);
    assert.ok(hard.some((item) => item.id === "flood_hard_exclusion"));
  });

  it("marks missing flood evidence as UNKNOWN and plans investigation", () => {
    const constraints = deriveCandidateConstraints({ ...BASE, floodQueried: false, floodOverlapPct: null });
    const missing = constraints.find((item) => item.id === "flood_unavailable");
    assert.equal(missing?.severity, "unknown");
    const next = deriveNextInvestigations(constraints);
    assert.ok(next.some((item) => item.id === "investigate_flood_unavailable"));
    assert.match(next.find((item) => item.id === "investigate_flood_unavailable")?.action ?? "", /Obtain flood/);
  });

  it("keeps hard exclusion beating numeric suitability score", () => {
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
      floodMode: "hard",
      floodHardExclusionPct: 1,
    };
    const screening = evaluateOpportunityScreening({
      criteria,
      candidate: {
        name: "Flooded",
        country: "SE",
        region: null,
        municipality: null,
        latitude: 59.2,
        longitude: 15.2,
        targetMw: null,
        targetMwh: null,
        siteAreaHa: 12,
        usableAreaHa: 12,
        contiguousUsableAreaHa: 12,
        technology: "battery_storage",
        covering: {
          queried: true,
          localCovered: true,
          nupCovered: false,
          localName: "Test",
          nupName: null,
          retrievedAt: null,
          sourceName: null,
        },
        protectedOverlap: { queried: true, overlapPercent: 0, names: [], sourceName: null },
        naturaOverlap: { queried: true, overlapPercent: 0, names: [], sourceName: null },
        floodOverlap: { queried: true, overlapPercent: 22, names: ["bhf"], sourceName: "MSB" },
      },
    });
    assert.equal(screening.excluded, true);
    assert.equal(suitabilityScoreV4({} as never, screening, criteria), 0);
  });

  it("never lets missing flood evidence improve environmental score vs evaluated zero overlap", () => {
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
    const missing = suitabilityScoreV4({ ...baseRow, flood_queried: false }, screening, criteria);
    const zero = suitabilityScoreV4(
      { ...baseRow, flood_queried: true, flood_overlap_pct: 0 },
      screening,
      criteria,
    );
    assert.ok(missing <= zero);
  });

  it("freezes flood constraints into Opportunity snapshot intelligence", () => {
    const constraints = deriveCandidateConstraints({ ...BASE, floodOverlapPct: 12 });
    const frozen = parseFrozenIntelligence({
      intelligence: {
        version: "candidate-intelligence-v1",
        constraintSemanticsVersion: "candidate-constraints-v1",
        investigationSemanticsVersion: "next-investigation-v1",
        constraints,
        nextInvestigations: deriveNextInvestigations(constraints),
        rankPositives: [],
        rankNegatives: [],
      },
    });
    assert.ok(frozen);
    assert.ok(frozen?.constraints.some((item) => item.id === "flood_major_overlap"));
  });

  it("formats trust copy without overclaiming", () => {
    assert.equal(formatFloodOverlapPct(0), "0%");
    assert.match(describeFloodOverlap({ overlapPct: 0 }), /flood exposure is absent/i);
    assert.match(describeFloodOverlap({ overlapPct: 18, classes: ["bhf"] }), /18\.0%/);
  });
});
