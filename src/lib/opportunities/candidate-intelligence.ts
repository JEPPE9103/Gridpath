import type { OpportunityRunCandidate } from "@/lib/data/opportunity-runs";
import type { ScreeningCriteria } from "@/lib/opportunities/screening";
import {
  CONSTRAINT_SEMANTICS_VERSION,
  deriveCandidateConstraints,
  type CandidateConstraint,
  type CandidateConstraintInput,
} from "@/lib/opportunities/constraints";
import {
  INVESTIGATION_SEMANTICS_VERSION,
  deriveNextInvestigations,
  type NextInvestigation,
} from "@/lib/opportunities/investigations";
import { whyCandidateRanks } from "@/lib/opportunities/evidence-coverage";
import { isOpportunityTechnology } from "@/lib/opportunities/catalog";
import { defaultScreeningProfile } from "@/lib/opportunities/screening-profiles";
import { parseGroundComposition } from "@/lib/opportunities/ground";

export const CANDIDATE_INTELLIGENCE_VERSION = "candidate-intelligence-v1";

export type CandidateIntelligence = {
  version: string;
  constraintSemanticsVersion: string;
  investigationSemanticsVersion: string;
  constraints: CandidateConstraint[];
  nextInvestigations: NextInvestigation[];
  rankPositives: string[];
  rankNegatives: string[];
};

export function intelligenceCriteriaForTechnology(
  technology: string,
  searchCriteria?: {
    maxSlopeDegrees?: number | null;
    slopeMode?: "preference" | "hard" | null;
    maxRoadDistanceM?: number | null;
    roadMode?: "preference" | "hard" | null;
    excludeProtected?: boolean;
    excludeNatura?: boolean;
    floodMode?: "preference" | "hard" | null;
    floodHardExclusionPct?: number | null;
    floodRiskOverlapPct?: number | null;
    floodMajorRiskOverlapPct?: number | null;
    groundMode?: "preference" | "hard" | null;
    groundHardExclusionPct?: number | null;
    groundClayRiskPct?: number | null;
    groundClayMajorRiskPct?: number | null;
    groundPeatRiskPct?: number | null;
    groundPeatMajorRiskPct?: number | null;
  } | null,
): Parameters<typeof constraintInputFromCandidate>[1] {
  const pack = defaultScreeningProfile(
    isOpportunityTechnology(technology) ? technology : "battery_storage",
  ).criteria;
  return {
    maxSlopeDegrees: searchCriteria?.maxSlopeDegrees ?? pack.maxSlopeDegrees,
    slopeMode: searchCriteria?.slopeMode === "hard" ? "hard" : pack.slopeMode,
    maxRoadDistanceM: searchCriteria?.maxRoadDistanceM ?? pack.maxRoadDistanceM,
    roadMode: searchCriteria?.roadMode === "hard" ? "hard" : pack.roadMode,
    excludeProtected: searchCriteria?.excludeProtected ?? pack.excludeProtected,
    excludeNatura: searchCriteria?.excludeNatura ?? pack.excludeNatura,
    floodMode: searchCriteria?.floodMode === "hard" ? "hard" : pack.floodMode,
    floodHardExclusionPct: searchCriteria?.floodHardExclusionPct ?? pack.floodHardExclusionPct,
    floodRiskOverlapPct: searchCriteria?.floodRiskOverlapPct ?? pack.floodRiskOverlapPct,
    floodMajorRiskOverlapPct: searchCriteria?.floodMajorRiskOverlapPct ?? pack.floodMajorRiskOverlapPct,
    groundMode: searchCriteria?.groundMode === "hard" ? "hard" : pack.groundMode,
    groundHardExclusionPct: searchCriteria?.groundHardExclusionPct ?? pack.groundHardExclusionPct,
    groundClayRiskPct: searchCriteria?.groundClayRiskPct ?? pack.groundClayRiskPct,
    groundClayMajorRiskPct: searchCriteria?.groundClayMajorRiskPct ?? pack.groundClayMajorRiskPct,
    groundPeatRiskPct: searchCriteria?.groundPeatRiskPct ?? pack.groundPeatRiskPct,
    groundPeatMajorRiskPct: searchCriteria?.groundPeatMajorRiskPct ?? pack.groundPeatMajorRiskPct,
  };
}

export function constraintInputFromCandidate(
  candidate: Pick<
    OpportunityRunCandidate,
    | "excluded"
    | "exclusionReason"
    | "geometryQuality"
    | "geometryQualityReason"
    | "terrainQueried"
    | "meanSlopeDeg"
    | "p90SlopeDeg"
    | "pctBelowSlope"
    | "terrainResolution"
    | "roadQueried"
    | "roadDistanceM"
    | "roadClass"
    | "landCoverQueried"
    | "protectedQueried"
    | "naturaQueried"
    | "coveringQueried"
    | "localCoveringName"
    | "nupCoveringName"
    | "floodQueried"
    | "floodOverlapPct"
    | "floodOverlapHa"
    | "floodClasses"
    | "groundQueried"
    | "groundComposition"
    | "groundDominantGroup"
    | "groundSourceClasses"
  > & {
    pctAboveSlope?: number | null;
    elevMinM?: number | null;
    elevMaxM?: number | null;
    elevRangeM?: number | null;
    detailedTerrainQueried?: boolean;
    terrainProviderKey?: string | null;
  },
  criteria?: Pick<
    ScreeningCriteria,
    | "maxSlopeDegrees"
    | "slopeMode"
    | "maxRoadDistanceM"
    | "roadMode"
    | "excludeProtected"
    | "excludeNatura"
    | "floodMode"
    | "floodHardExclusionPct"
    | "floodRiskOverlapPct"
    | "floodMajorRiskOverlapPct"
    | "groundMode"
    | "groundHardExclusionPct"
    | "groundClayRiskPct"
    | "groundClayMajorRiskPct"
    | "groundPeatRiskPct"
    | "groundPeatMajorRiskPct"
  >,
): CandidateConstraintInput {
  return {
    excluded: candidate.excluded,
    exclusionReason: candidate.exclusionReason,
    geometryQuality: candidate.geometryQuality,
    geometryQualityReason: candidate.geometryQualityReason,
    terrainQueried: candidate.terrainQueried,
    meanSlopeDeg: candidate.meanSlopeDeg,
    p90SlopeDeg: candidate.p90SlopeDeg,
    pctBelowSlope: candidate.pctBelowSlope,
    pctAboveSlope: candidate.pctAboveSlope ?? null,
    elevMinM: candidate.elevMinM ?? null,
    elevMaxM: candidate.elevMaxM ?? null,
    elevRangeM: candidate.elevRangeM ?? null,
    detailedTerrainQueried: candidate.detailedTerrainQueried === true,
    terrainResolution: candidate.terrainResolution,
    terrainProviderKey: candidate.terrainProviderKey ?? null,
    maxSlopeDegrees: criteria?.maxSlopeDegrees ?? 5,
    slopeMode: criteria?.slopeMode ?? "preference",
    roadQueried: candidate.roadQueried,
    roadDistanceM: candidate.roadDistanceM,
    roadClass: candidate.roadClass,
    maxRoadDistanceM: criteria?.maxRoadDistanceM ?? 1000,
    roadMode: criteria?.roadMode ?? "preference",
    landCoverQueried: candidate.landCoverQueried,
    protectedQueried: candidate.protectedQueried,
    naturaQueried: candidate.naturaQueried,
    excludeProtected: criteria?.excludeProtected ?? true,
    excludeNatura: criteria?.excludeNatura ?? true,
    coveringQueried: candidate.coveringQueried,
    localCoveringName: candidate.localCoveringName,
    nupCoveringName: candidate.nupCoveringName,
    floodQueried: candidate.floodQueried,
    floodOverlapPct: candidate.floodOverlapPct,
    floodOverlapHa: candidate.floodOverlapHa,
    floodClasses: candidate.floodClasses,
    floodMode: criteria?.floodMode ?? "preference",
    floodHardExclusionPct: criteria?.floodHardExclusionPct ?? 1,
    floodRiskOverlapPct: criteria?.floodRiskOverlapPct ?? 1,
    floodMajorRiskOverlapPct: criteria?.floodMajorRiskOverlapPct ?? 10,
    groundQueried: candidate.groundQueried,
    groundComposition: candidate.groundComposition,
    groundDominantGroup: candidate.groundDominantGroup,
    groundSourceClasses: candidate.groundSourceClasses,
    groundMode: criteria?.groundMode ?? "preference",
    groundHardExclusionPct: criteria?.groundHardExclusionPct ?? 40,
    groundClayRiskPct: criteria?.groundClayRiskPct ?? 15,
    groundClayMajorRiskPct: criteria?.groundClayMajorRiskPct ?? 40,
    groundPeatRiskPct: criteria?.groundPeatRiskPct ?? 5,
    groundPeatMajorRiskPct: criteria?.groundPeatMajorRiskPct ?? 15,
  };
}

export function whyCandidateLags(candidate: {
  geometryQuality?: string | null;
  terrainQueried?: boolean;
  detailedTerrainQueried?: boolean;
  meanSlopeDeg?: number | null;
  pctAboveSlope?: number | null;
  elevRangeM?: number | null;
  roadQueried?: boolean;
  landCoverQueried?: boolean;
  landCover?: Record<string, number>;
  coveringQueried?: boolean;
  localCoveringName?: string | null;
  nupCoveringName?: string | null;
  floodQueried?: boolean;
  floodOverlapPct?: number | null;
  groundQueried?: boolean;
  groundComposition?: Record<string, number>;
  keyRisk?: string | null;
  excluded?: boolean;
}): string[] {
  const negatives: string[] = [];
  if (candidate.excluded) negatives.push("Excluded by the current screening profile");
  if (candidate.geometryQuality === "review") negatives.push("Footprint geometry needs review");
  if (candidate.terrainQueried !== true) negatives.push("Terrain evidence unavailable");
  else if (candidate.detailedTerrainQueried !== true) {
    negatives.push("Detailed terrain not evaluated");
  } else if (candidate.pctAboveSlope != null && candidate.pctAboveSlope >= 15) {
    negatives.push("Material steep share in detailed terrain");
  } else if (candidate.elevRangeM != null && candidate.elevRangeM >= 12) {
    negatives.push("Notable elevation variation in detailed terrain");
  } else if (candidate.meanSlopeDeg != null && candidate.meanSlopeDeg > 8) {
    negatives.push("Higher observed coarse slope");
  }
  if (candidate.roadQueried !== true) negatives.push("Road access not evaluated");
  if (candidate.landCoverQueried !== true) negatives.push("Land cover not evaluated");
  else if (Number(candidate.landCover?.water ?? 0) + Number(candidate.landCover?.wetland ?? 0) >= 20) {
    negatives.push("Material water or wetland share in the screening envelope");
  }
  if (candidate.coveringQueried === true && !candidate.localCoveringName && !candidate.nupCoveringName) {
    negatives.push("No official covering polygon at the centroid");
  }
  if (candidate.floodQueried !== true) negatives.push("Flood / water evidence not evaluated");
  else if (candidate.floodOverlapPct != null && candidate.floodOverlapPct >= 1) {
    negatives.push("Mapped flood geography intersects the Candidate footprint");
  }
  if (candidate.groundQueried !== true) negatives.push("Ground / soil evidence not evaluated");
  else if (
    Number(candidate.groundComposition?.CLAY_FINE_SEDIMENT ?? 0) >= 15 ||
    Number(candidate.groundComposition?.PEAT_ORGANIC ?? 0) >= 5
  ) {
    negatives.push("Mapped clay or peat/organic ground indicated across part of the footprint");
  }
  if (negatives.length === 0 && candidate.keyRisk) negatives.push(candidate.keyRisk);
  return negatives.slice(0, 4);
}

export function buildCandidateIntelligence(
  candidate: Parameters<typeof constraintInputFromCandidate>[0] &
    Parameters<typeof whyCandidateRanks>[0] &
    Parameters<typeof whyCandidateLags>[0],
  criteria?: Parameters<typeof constraintInputFromCandidate>[1],
): CandidateIntelligence {
  const constraints = deriveCandidateConstraints(constraintInputFromCandidate(candidate, criteria));
  return {
    version: CANDIDATE_INTELLIGENCE_VERSION,
    constraintSemanticsVersion: CONSTRAINT_SEMANTICS_VERSION,
    investigationSemanticsVersion: INVESTIGATION_SEMANTICS_VERSION,
    constraints,
    nextInvestigations: deriveNextInvestigations(constraints),
    rankPositives: whyCandidateRanks({
      ...candidate,
      maxRoadDistanceM: criteria?.maxRoadDistanceM ?? candidate.maxRoadDistanceM ?? 1000,
    }),
    rankNegatives: whyCandidateLags(candidate),
  };
}

export function constraintInputFromScreeningCell(
  row: {
    geometry_quality?: string | null;
    terrain_queried?: boolean | null;
    mean_slope_deg?: number | string | null;
    p90_slope_deg?: number | string | null;
    pct_below_slope?: number | string | null;
    pct_above_slope?: number | string | null;
    elev_min_m?: number | string | null;
    elev_max_m?: number | string | null;
    elev_range_m?: number | string | null;
    detailed_terrain_queried?: boolean | null;
    terrain_resolution?: string | null;
    terrain_provider_key?: string | null;
    road_queried?: boolean | null;
    road_distance_m?: number | string | null;
    road_class?: string | null;
    land_cover_queried?: boolean | null;
    protected_queried?: boolean | null;
    natura_queried?: boolean | null;
    covering_queried?: boolean | null;
    local_covering_name?: string | null;
    nup_covering_name?: string | null;
    land_cover?: Record<string, number> | null;
    flood_queried?: boolean | null;
    flood_overlap_pct?: number | string | null;
    flood_overlap_ha?: number | string | null;
    flood_classes?: string[] | null;
    ground_queried?: boolean | null;
    ground_composition?: Record<string, number> | null;
    ground_dominant_group?: string | null;
    ground_source_classes?: string[] | null;
  },
  criteria?: Parameters<typeof constraintInputFromCandidate>[1],
  extras?: { excluded?: boolean; exclusionReason?: string | null },
): CandidateConstraintInput {
  const num = (value: number | string | null | undefined) => {
    if (value == null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return constraintInputFromCandidate(
    {
      excluded: extras?.excluded ?? false,
      exclusionReason: extras?.exclusionReason ?? null,
      geometryQuality: row.geometry_quality ?? null,
      geometryQualityReason: null,
      terrainQueried: row.terrain_queried === true,
      meanSlopeDeg: num(row.mean_slope_deg),
      p90SlopeDeg: num(row.p90_slope_deg),
      pctBelowSlope: num(row.pct_below_slope),
      pctAboveSlope: num(row.pct_above_slope),
      elevMinM: num(row.elev_min_m),
      elevMaxM: num(row.elev_max_m),
      elevRangeM: num(row.elev_range_m),
      detailedTerrainQueried: row.detailed_terrain_queried === true,
      terrainResolution: row.terrain_resolution ?? null,
      terrainProviderKey: row.terrain_provider_key ?? null,
      roadQueried: row.road_queried === true,
      roadDistanceM: num(row.road_distance_m),
      roadClass: row.road_class ?? null,
      landCoverQueried: row.land_cover_queried === true,
      protectedQueried: row.protected_queried === true,
      naturaQueried: row.natura_queried === true,
      coveringQueried: row.covering_queried === true,
      localCoveringName: row.local_covering_name ?? null,
      nupCoveringName: row.nup_covering_name ?? null,
      floodQueried: row.flood_queried === true,
      floodOverlapPct: num(row.flood_overlap_pct),
      floodOverlapHa: num(row.flood_overlap_ha),
      floodClasses: Array.isArray(row.flood_classes) ? row.flood_classes.map(String) : [],
      groundQueried: row.ground_queried === true,
      groundComposition: parseGroundComposition(row.ground_composition),
      groundDominantGroup: row.ground_dominant_group ?? null,
      groundSourceClasses: Array.isArray(row.ground_source_classes)
        ? row.ground_source_classes.map(String)
        : [],
    },
    criteria,
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function parseFrozenIntelligence(raw: unknown): CandidateIntelligence | null {
  const root = asRecord(raw);
  if (!root) return null;
  const screening = asRecord(root.screening);
  const nested = asRecord(root.intelligence) ?? asRecord(screening?.intelligence) ?? root;
  const constraints = Array.isArray(nested.constraints) ? (nested.constraints as CandidateConstraint[]) : null;
  const nextInvestigations = Array.isArray(nested.nextInvestigations)
    ? (nested.nextInvestigations as NextInvestigation[])
    : null;
  if (!constraints || !nextInvestigations) return null;
  return {
    version: typeof nested.version === "string" ? nested.version : CANDIDATE_INTELLIGENCE_VERSION,
    constraintSemanticsVersion:
      typeof nested.constraintSemanticsVersion === "string"
        ? nested.constraintSemanticsVersion
        : CONSTRAINT_SEMANTICS_VERSION,
    investigationSemanticsVersion:
      typeof nested.investigationSemanticsVersion === "string"
        ? nested.investigationSemanticsVersion
        : INVESTIGATION_SEMANTICS_VERSION,
    constraints,
    nextInvestigations,
    rankPositives: Array.isArray(nested.rankPositives) ? nested.rankPositives.map(String) : [],
    rankNegatives: Array.isArray(nested.rankNegatives) ? nested.rankNegatives.map(String) : [],
  };
}

export function intelligenceHeadline(intelligence: CandidateIntelligence): string {
  const blockers = intelligence.constraints.filter((item) => item.severity === "blocker").length;
  const major = intelligence.constraints.filter((item) => item.severity === "major_risk").length;
  const unknowns = intelligence.constraints.filter(
    (item) => item.severity === "unknown" && item.id !== "residential_not_evaluated",
  ).length;
  const parts: string[] = [];
  if (blockers) parts.push(`${blockers} blocker${blockers === 1 ? "" : "s"}`);
  if (major) parts.push(`${major} major risk${major === 1 ? "" : "s"}`);
  if (unknowns) parts.push(`${unknowns} unknown${unknowns === 1 ? "" : "s"}`);
  const next = intelligence.nextInvestigations[0]?.action;
  if (next) parts.push(`Next: ${next}`);
  return parts.join(" · ") || "No screening constraints recorded";
}

export function constraintTitlesForCompare(
  intelligence: CandidateIntelligence,
  severity: CandidateConstraint["severity"],
): string {
  const titles = intelligence.constraints
    .filter((item) => item.severity === severity && item.id !== "residential_not_evaluated")
    .map((item) => item.title);
  return titles.length ? titles.join("; ") : "None recorded";
}

export function nextInvestigationForCompare(intelligence: CandidateIntelligence): string {
  const first = intelligence.nextInvestigations[0];
  if (!first) return "None generated from current evidence";
  return `${first.action} (${first.priority})`;
}
