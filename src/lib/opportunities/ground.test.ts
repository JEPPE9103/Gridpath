import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveCandidateConstraints, hasBlocker } from "./constraints";
import { deriveNextInvestigations } from "./investigations";
import { parseFrozenIntelligence } from "./candidate-intelligence";
import { opportunityCopyContainsForbiddenTerm } from "./copy";
import {
  GROUND_CLAY_MAJOR_RISK_PCT,
  GROUND_CLAY_RISK_PCT,
  GROUND_HARD_EXCLUSION_PCT,
  GROUND_PEAT_MAJOR_RISK_PCT,
  GROUND_PEAT_RISK_PCT,
  describeGroundComposition,
  formatGroundComposition,
  normalizeSguGroundClass,
} from "./ground";
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
  groundComposition: { TILL: 70, BEDROCK: 30 } as Record<string, number>,
  groundDominantGroup: "TILL",
  groundSourceClasses: ["Morän", "Urberg"],
  groundMode: "preference" as const,
  groundHardExclusionPct: GROUND_HARD_EXCLUSION_PCT,
  groundClayRiskPct: GROUND_CLAY_RISK_PCT,
  groundClayMajorRiskPct: GROUND_CLAY_MAJOR_RISK_PCT,
  groundPeatRiskPct: GROUND_PEAT_RISK_PCT,
  groundPeatMajorRiskPct: GROUND_PEAT_MAJOR_RISK_PCT,
  contaminationQueried: true,
  contaminationIntersectingCount: 0,
  contaminationNearbyCount: 0,
  contaminationNearestM: null as number | null,
  contaminationRiskClasses: [] as string[],
  contaminationMode: "preference" as const,
};

describe("SGU ground intelligence", () => {
  it("normalizes SGU jg2 codes into screening groups", () => {
    assert.equal(normalizeSguGroundClass(40, "Glacial lera"), "CLAY_FINE_SEDIMENT");
    assert.equal(normalizeSguGroundClass(75, "Torv"), "PEAT_ORGANIC");
    assert.equal(normalizeSguGroundClass(100, "Morän"), "TILL");
    assert.equal(normalizeSguGroundClass(890, "Urberg"), "BEDROCK");
    assert.equal(normalizeSguGroundClass(31, "Postglacial sand"), "SAND_GRAVEL");
    assert.equal(normalizeSguGroundClass(91, "Vatten"), "OTHER");
  });

  it("maps clay overlap to RISK / MAJOR_RISK and never default BLOCKER", () => {
    const risk = deriveCandidateConstraints({
      ...BASE,
      groundComposition: { CLAY_FINE_SEDIMENT: 22, TILL: 78 },
      groundDominantGroup: "CLAY_FINE_SEDIMENT",
    });
    assert.ok(risk.some((item) => item.id === "ground_clay_risk"));
    assert.equal(hasBlocker(risk), false);

    const major = deriveCandidateConstraints({
      ...BASE,
      groundComposition: { CLAY_FINE_SEDIMENT: 45, TILL: 55 },
    });
    assert.ok(major.some((item) => item.id === "ground_clay_major" && item.severity === "major_risk"));
    assert.equal(hasBlocker(major), false);
  });

  it("maps peat overlap to RISK / MAJOR_RISK", () => {
    const peat = deriveCandidateConstraints({
      ...BASE,
      groundComposition: { PEAT_ORGANIC: 12, TILL: 88 },
    });
    assert.ok(peat.some((item) => item.id === "ground_peat_risk"));
    const major = deriveCandidateConstraints({
      ...BASE,
      groundComposition: { PEAT_ORGANIC: 20, TILL: 80 },
    });
    assert.ok(major.some((item) => item.id === "ground_peat_major"));
  });

  it("uses BLOCKER only for hard exclusion profile", () => {
    const hard = deriveCandidateConstraints({
      ...BASE,
      groundMode: "hard",
      groundComposition: { CLAY_FINE_SEDIMENT: 50 },
      groundHardExclusionPct: 40,
    });
    assert.ok(hard.some((item) => item.id === "ground_clay_hard_exclusion"));
    assert.equal(hasBlocker(hard), true);
  });

  it("marks missing SGU as UNKNOWN and plans investigation", () => {
    const constraints = deriveCandidateConstraints({
      ...BASE,
      groundQueried: false,
      groundComposition: {},
      groundDominantGroup: null,
    });
    const missing = constraints.find((item) => item.id === "ground_unavailable");
    assert.equal(missing?.severity, "unknown");
    const next = deriveNextInvestigations(constraints);
    assert.ok(next.some((item) => item.id === "investigate_ground_unavailable"));
    assert.match(
      next.find((item) => item.id === "investigate_ground_unavailable")?.action ?? "",
      /Obtain ground-condition/,
    );
  });

  it("reports till/bedrock as INFO context without forbidden geotechnical claims", () => {
    const constraints = deriveCandidateConstraints(BASE);
    const info = constraints.find((item) => item.id === "ground_mapped_context");
    assert.equal(info?.severity, "info");
    const blob = `${info?.explanation ?? ""} ${info?.whyItMatters ?? ""} ${describeGroundComposition({
      composition: BASE.groundComposition,
      dominant: "TILL",
    })} ${formatGroundComposition(BASE.groundComposition)}`;
    assert.equal(opportunityCopyContainsForbiddenTerm(blob), null);
    assert.equal(opportunityCopyContainsForbiddenTerm("piling required"), "piling required");
    assert.equal(opportunityCopyContainsForbiddenTerm("geotechnically feasible"), "geotechnically feasible");
  });

  it("plans clay investigation without stating engineering conclusions", () => {
    const constraints = deriveCandidateConstraints({
      ...BASE,
      groundComposition: { CLAY_FINE_SEDIMENT: 42, TILL: 58 },
    });
    const next = deriveNextInvestigations(constraints);
    const clay = next.find((item) => item.constraintId === "ground_clay_major" || item.constraintId === "ground_clay_risk");
    assert.ok(clay);
    assert.match(clay?.action ?? "", /geotechnical investigation/i);
    assert.equal(opportunityCopyContainsForbiddenTerm(clay?.action ?? ""), null);
  });

  it("does not let missing ground evidence improve suitability score", () => {
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
    const screening = evaluateOpportunityScreening({
      criteria,
      candidate: {
        name: "Ground",
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
        floodOverlap: { queried: true, overlapPercent: 0, names: [], sourceName: "MSB" },
      },
    });
    const baseRow = {
      contiguous_area_ha: 15,
      usable_area_ha: 15,
      protected_queried: true,
      natura_queried: true,
      protected_overlap_pct: 0,
      natura_overlap_pct: 0,
      terrain_queried: true,
      mean_slope_deg: 2,
      pct_below_slope: 95,
      land_cover_queried: true,
      land_cover: { open: 80, forest: 20 },
      road_queried: true,
      road_distance_m: 100,
      covering_queried: true,
      local_covering_name: "E.ON",
      flood_queried: true,
      flood_overlap_pct: 0,
      ground_queried: true,
      ground_composition: { TILL: 100 },
      geometry_quality: "pass",
      target_fit_score: 1,
    };
    const withGround = suitabilityScoreV4(baseRow, screening, criteria);
    const missing = suitabilityScoreV4(
      { ...baseRow, ground_queried: false, ground_composition: {} },
      screening,
      criteria,
    );
    assert.ok(missing <= withGround);
  });

  it("freezes ground constraints into Opportunity intelligence snapshot", () => {
    const constraints = deriveCandidateConstraints({
      ...BASE,
      groundComposition: { CLAY_FINE_SEDIMENT: 42, TILL: 58 },
    });
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
    assert.ok(frozen?.constraints.some((item) => item.id === "ground_clay_major" || item.id === "ground_clay_risk"));
  });
});
