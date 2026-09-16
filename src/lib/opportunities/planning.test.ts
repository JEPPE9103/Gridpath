import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCandidateIntelligence, parseFrozenIntelligence } from "./candidate-intelligence";
import { deriveCandidateConstraints, hasBlocker } from "./constraints";
import { opportunityCopyContainsForbiddenTerm } from "./copy";
import { deriveNextInvestigations } from "./investigations";
import {
  describePlanningEvidence,
  formatPlanningOverlapPct,
  normalizeMalmoPlanRecord,
} from "./planning";
import {
  planningProvidersForBbox,
  supportedPlanningProviders,
  unavailablePlanningProvidersForBbox,
} from "./planning-providers";
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
  planningQueried: true,
  planningIntersectingCount: 0,
  planningOverlapPct: 0,
  planningNearestM: null as number | null,
  planningPlanIds: [] as string[],
  planningPlanNames: [] as string[],
  planningPlanStatuses: [] as string[],
  planningMunicipality: "Malmö",
  planningProviderKey: "malmo-gallande-detaljplaner",
};

describe("planning intelligence", () => {
  it("registers Malmö as supported and Göteborg/Örebro as unavailable", () => {
    assert.equal(supportedPlanningProviders().length, 1);
    assert.equal(supportedPlanningProviders()[0]?.municipalityName, "Malmö");
    const gbg = planningProvidersForBbox({ west: 11.8, south: 57.65, east: 12.0, north: 57.75 });
    assert.ok(gbg.some((p) => p.key === "goteborg-detaljplan" && p.status === "unavailable"));
    const ore = unavailablePlanningProvidersForBbox({
      west: 15.1,
      south: 59.2,
      east: 15.25,
      north: 59.3,
    });
    assert.ok(ore.some((p) => p.key === "orebro-detaljplan"));
  });

  it("preserves Malmö source terminology in normalization", () => {
    const normalized = normalizeMalmoPlanRecord({
      PLAN_: "DP5123",
      PLANNAMN: "Testområdet",
      LAGAKRAFT_: "20180315",
      LMAKT: "1280K-DP5123",
      BESLUTSDAT: "20180201",
      url_dok: "https://example.malmo.se/plan",
    });
    assert.equal(normalized.planId, "DP5123");
    assert.equal(normalized.planName, "Testområdet");
    assert.match(normalized.planStatus ?? "", /Gällande/);
    assert.match(normalized.planStatus ?? "", /20180315/);
    assert.equal(normalized.lmAkt, "1280K-DP5123");
    assert.equal(normalized.municipalityCode, "1280");
  });

  it("treats evaluated zero mapped plans as INFO, never no-planning-risk language", () => {
    const constraints = deriveCandidateConstraints(BASE);
    const row = constraints.find((item) => item.id === "planning_outside_mapped_plans");
    assert.equal(row?.severity, "info");
    assert.match(row?.explanation ?? "", /not a finding of absent planning context/i);
    assert.equal(opportunityCopyContainsForbiddenTerm(row?.explanation ?? ""), null);
    assert.equal(opportunityCopyContainsForbiddenTerm("no planning risk"), "no planning risk");
    assert.equal(opportunityCopyContainsForbiddenTerm("project permitted"), "project permitted");
  });

  it("maps intersecting plans to RISK and never default BLOCKER", () => {
    const constraints = deriveCandidateConstraints({
      ...BASE,
      planningIntersectingCount: 2,
      planningOverlapPct: 62,
      planningPlanIds: ["DP5123", "DP4000"],
      planningPlanNames: ["Testområdet"],
      planningPlanStatuses: ["Gällande"],
    });
    const row = constraints.find((item) => item.id === "planning_intersecting_plan");
    assert.equal(row?.severity, "risk");
    assert.equal(hasBlocker(constraints), false);
    assert.match(row?.measuredValue ?? "", /62%/);
    assert.match(describePlanningEvidence({
      queried: true,
      intersectingCount: 2,
      overlapPct: 62,
      planIds: ["DP5123"],
    }), /permitting conclusion/i);
  });

  it("marks unavailable planning as UNKNOWN with deterministic Next Investigation", () => {
    const constraints = deriveCandidateConstraints({
      ...BASE,
      planningQueried: false,
      planningIntersectingCount: null,
      planningOverlapPct: null,
      planningMunicipality: null,
      planningProviderKey: null,
    });
    const row = constraints.find((item) => item.id === "planning_unavailable");
    assert.equal(row?.severity, "unknown");
    const next = deriveNextInvestigations(constraints);
    const planningNext = next.find((item) => item.constraintId === "planning_unavailable");
    assert.ok(planningNext);
    assert.equal(planningNext?.priority, "now");
    assert.match(planningNext?.action ?? "", /Confirm municipal planning context/i);
  });

  it("does not let missing planning evidence improve suitability score", () => {
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
      latitude: 55.6,
      longitude: 13.0,
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
      planning_queried: true,
      planning_intersecting_count: 0,
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
        latitude: 55.6,
        longitude: 13.0,
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
      { ...baseRow, planning_queried: false, planning_intersecting_count: null },
      screening,
      criteria,
    );
    assert.ok(missing <= evaluated);
  });

  it("freezes planning constraints into Opportunity intelligence snapshot", () => {
    const intelligence = buildCandidateIntelligence({
      ...BASE,
      planningIntersectingCount: 1,
      planningOverlapPct: 40,
      planningPlanIds: ["DP5123"],
      planningPlanNames: ["Testområdet"],
      planningPlanStatuses: ["Gällande"],
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
    assert.ok(frozen?.constraints.some((row) => row.id === "planning_intersecting_plan"));
    assert.equal(formatPlanningOverlapPct(40), "40%");
  });
});
