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
  >,
  criteria?: Pick<
    ScreeningCriteria,
    | "maxSlopeDegrees"
    | "slopeMode"
    | "maxRoadDistanceM"
    | "roadMode"
    | "excludeProtected"
    | "excludeNatura"
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
    terrainResolution: candidate.terrainResolution,
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
  };
}

export function whyCandidateLags(candidate: {
  geometryQuality?: string | null;
  terrainQueried?: boolean;
  meanSlopeDeg?: number | null;
  roadQueried?: boolean;
  landCoverQueried?: boolean;
  landCover?: Record<string, number>;
  coveringQueried?: boolean;
  localCoveringName?: string | null;
  nupCoveringName?: string | null;
  keyRisk?: string | null;
  excluded?: boolean;
}): string[] {
  const negatives: string[] = [];
  if (candidate.excluded) negatives.push("Excluded by the current screening profile");
  if (candidate.geometryQuality === "review") negatives.push("Footprint geometry needs review");
  if (candidate.terrainQueried !== true) negatives.push("Terrain evidence unavailable");
  else if (candidate.meanSlopeDeg != null && candidate.meanSlopeDeg > 8) {
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
    terrain_resolution?: string | null;
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
      terrainResolution: row.terrain_resolution ?? null,
      roadQueried: row.road_queried === true,
      roadDistanceM: num(row.road_distance_m),
      roadClass: row.road_class ?? null,
      landCoverQueried: row.land_cover_queried === true,
      protectedQueried: row.protected_queried === true,
      naturaQueried: row.natura_queried === true,
      coveringQueried: row.covering_queried === true,
      localCoveringName: row.local_covering_name ?? null,
      nupCoveringName: row.nup_covering_name ?? null,
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
