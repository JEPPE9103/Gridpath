import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveCandidateConstraints, hasBlocker } from "./constraints";
import { deriveNextInvestigations } from "./investigations";
import { parseFrozenIntelligence } from "./candidate-intelligence";
import { opportunityCopyContainsForbiddenTerm } from "./copy";
import {
  DETAILED_TERRAIN_RELIEF_MAJOR_M,
  DETAILED_TERRAIN_RELIEF_RISK_M,
  DETAILED_TERRAIN_STEEP_MAJOR_RISK_PCT,
  DETAILED_TERRAIN_STEEP_RISK_PCT,
  classifyDetailedTerrainSeverity,
  describeDetailedTerrain,
  formatElevRangeM,
  formatSlopeDeg,
  formatSteepPct,
  isDetailedTerrainEvaluated,
} from "./detailed-terrain";
import { suitabilityScoreV4 } from "./run-ranking";
import type { ScreeningCriteria } from "./screening";
import { evaluateOpportunityScreening } from "./screening";

const BASE = {
  excluded: false,
  exclusionReason: null,
  geometryQuality: "pass" as const,
  geometryQualityReason: null,
  terrainQueried: true,
  meanSlopeDeg: 2.1,
  p90SlopeDeg: 3.4,
  pctBelowSlope: 96,
  pctAboveSlope: 4,
  elevMinM: 40,
  elevMaxM: 44,
  elevRangeM: 4,
  terrainResolution: "detailed" as const,
  terrainProviderKey: "lantmateriet-dtm-1m",
  detailedTerrainQueried: true,
  maxSlopeDegrees: 5,
  slopeMode: "preference" as const,
  steepRiskPct: DETAILED_TERRAIN_STEEP_RISK_PCT,
  steepMajorRiskPct: DETAILED_TERRAIN_STEEP_MAJOR_RISK_PCT,
  reliefRiskM: DETAILED_TERRAIN_RELIEF_RISK_M,
  reliefMajorM: DETAILED_TERRAIN_RELIEF_MAJOR_M,
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
  groundQueried: true,
  groundComposition: { TILL: 100 } as Record<string, number>,
  groundDominantGroup: "TILL",
  groundSourceClasses: ["Morän"],
  groundMode: "preference" as const,
};

describe("detailed terrain intelligence", () => {
  it("marks covered detailed terrain within preference as INFO", () => {
    const constraints = deriveCandidateConstraints(BASE);
    const row = constraints.find((item) => item.id === "detailed_terrain_context");
    assert.equal(row?.severity, "info");
    assert.equal(row?.evaluated, true);
    assert.match(row?.explanation ?? "", /Detailed terrain indicates|mean slope/i);
    assert.equal(opportunityCopyContainsForbiddenTerm(row?.explanation ?? ""), null);
    assert.equal(opportunityCopyContainsForbiddenTerm(row?.whyItMatters ?? ""), null);
  });

  it("maps steep share to RISK and MAJOR_RISK", () => {
    const risk = deriveCandidateConstraints({ ...BASE, pctAboveSlope: 18, elevRangeM: 6 }).find(
      (item) => item.id === "detailed_terrain_steep_risk",
    );
    const major = deriveCandidateConstraints({ ...BASE, pctAboveSlope: 40, elevRangeM: 8 }).find(
      (item) => item.id === "detailed_terrain_steep_major",
    );
    assert.equal(risk?.severity, "risk");
    assert.equal(major?.severity, "major_risk");
    assert.match(risk?.explanation ?? "", /18\.0%|18%/);
  });

  it("maps elevation range to relief RISK and MAJOR_RISK", () => {
    const risk = deriveCandidateConstraints({ ...BASE, pctAboveSlope: 2, elevRangeM: 14 }).find(
      (item) => item.id === "detailed_terrain_relief_risk",
    );
    const major = deriveCandidateConstraints({ ...BASE, pctAboveSlope: 2, elevRangeM: 28 }).find(
      (item) => item.id === "detailed_terrain_relief_major",
    );
    assert.equal(risk?.severity, "risk");
    assert.equal(major?.severity, "major_risk");
  });

  it("uses BLOCKER only for hard terrain exclusion profile", () => {
    const preference = deriveCandidateConstraints({
      ...BASE,
      meanSlopeDeg: 9,
      pctAboveSlope: 40,
      slopeMode: "preference",
    });
    assert.equal(hasBlocker(preference), false);
    const hard = deriveCandidateConstraints({
      ...BASE,
      meanSlopeDeg: 9,
      pctAboveSlope: 40,
      slopeMode: "hard",
    });
    assert.equal(hasBlocker(hard), true);
    assert.ok(hard.some((item) => item.id === "detailed_terrain_steep_hard_exclusion"));
  });

  it("marks missing detailed terrain as UNKNOWN and plans investigation", () => {
    const constraints = deriveCandidateConstraints({
      ...BASE,
      detailedTerrainQueried: false,
      terrainResolution: "coarse",
      terrainProviderKey: "copernicus-dem-glo90",
      pctAboveSlope: null,
      elevRangeM: null,
    });
    const missing = constraints.find((item) => item.id === "detailed_terrain_unavailable");
    assert.equal(missing?.severity, "unknown");
    assert.match(missing?.title ?? "", /not evaluated/i);
    const next = deriveNextInvestigations(constraints);
    assert.ok(next.some((item) => item.id === "investigate_detailed_terrain_unavailable"));
    assert.match(
      next.find((item) => item.id === "investigate_detailed_terrain_unavailable")?.action ?? "",
      /Lantmäteriet|detailed terrain/i,
    );
  });

  it("plans grading review when detailed terrain is steep", () => {
    const constraints = deriveCandidateConstraints({ ...BASE, pctAboveSlope: 22, elevRangeM: 10 });
    const next = deriveNextInvestigations(constraints);
    const item = next.find((row) => row.constraintId === "detailed_terrain_steep_risk");
    assert.ok(item);
    assert.equal(item?.priority, "next");
    assert.match(item?.action ?? "", /grading \/ earthworks implications/i);
    assert.match(item?.evidenceSource ?? "", /Lantmäteriet/i);
  });

  it("never lets missing detailed terrain improve terrain score vs evaluated preferred terrain", () => {
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
      pct_below_slope: 95,
      land_cover_queried: true,
      land_cover: { open: 80 },
      road_queried: true,
      road_distance_m: 100,
      target_fit_score: 0.9,
      geometry_quality: "pass",
      flood_queried: true,
      flood_overlap_pct: 0,
      ground_queried: true,
      ground_composition: { TILL: 100 },
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
    const missing = suitabilityScoreV4(
      { ...baseRow, detailed_terrain_queried: false, terrain_resolution: "coarse" },
      screening,
      criteria,
    );
    const detailed = suitabilityScoreV4(
      {
        ...baseRow,
        detailed_terrain_queried: true,
        terrain_resolution: "detailed",
        terrain_provider_key: "lantmateriet-dtm-1m",
        pct_below_slope: 95,
      },
      screening,
      criteria,
    );
    assert.ok(missing <= detailed);
  });

  it("freezes detailed terrain constraints into Opportunity snapshot intelligence", () => {
    const constraints = deriveCandidateConstraints({ ...BASE, pctAboveSlope: 22 });
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
    assert.ok(frozen?.constraints.some((item) => item.id === "detailed_terrain_steep_risk"));
    assert.ok(
      frozen?.nextInvestigations.some((item) => item.constraintId === "detailed_terrain_steep_risk"),
    );
  });

  it("keeps provenance and forbids engineering overclaims", () => {
    assert.equal(isDetailedTerrainEvaluated({ detailedTerrainQueried: true }), true);
    assert.equal(
      isDetailedTerrainEvaluated({
        detailedTerrainQueried: false,
        terrainResolution: "coarse",
        terrainProviderKey: "copernicus-dem-glo90",
      }),
      false,
    );
    assert.equal(formatSlopeDeg(2.14), "2.1°");
    assert.equal(formatElevRangeM(11.4), "11.4 m");
    assert.equal(formatSteepPct(14.2), "14.2%");
    assert.match(
      describeDetailedTerrain({ meanSlopeDeg: 2.1, p90SlopeDeg: 5.8, elevRangeM: 11.4, pctAboveSlope: 14 }),
      /Detailed terrain indicates/,
    );
    assert.equal(opportunityCopyContainsForbiddenTerm("constructable pad"), "constructable");
    assert.equal(opportunityCopyContainsForbiddenTerm("no earthworks needed"), "no earthworks needed");
    assert.equal(opportunityCopyContainsForbiddenTerm("grading cost estimate"), "grading cost");
    assert.equal(opportunityCopyContainsForbiddenTerm("cut/fill volume"), "cut/fill volume");
    assert.equal(opportunityCopyContainsForbiddenTerm("stable ground"), "stable ground");
    assert.equal(opportunityCopyContainsForbiddenTerm("buildable footprint"), "buildable");
    assert.equal(
      classifyDetailedTerrainSeverity({ pctAboveSlope: 40, elevRangeM: 5 }).severity,
      "major_risk",
    );
  });
});
