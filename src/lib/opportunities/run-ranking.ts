import type { OpportunityRecommendationValue } from "@/lib/opportunities/catalog";
import { recommendationRank } from "@/lib/opportunities/compare";
import {
  emptyLandCoverComposition,
  parseLandCoverProfile,
  type LandCoverComposition,
} from "@/lib/opportunities/land-cover";
import {
  RANKING_VERSION,
} from "@/lib/opportunities/screening-profiles";
import {
  resolveSiteAreaProfile,
  targetFitAssessment,
} from "@/lib/opportunities/site-generation";
import {
  deriveStrategicFlags,
  explainRankChange,
  type EvidenceResolution,
  type StrategicFlag,
} from "@/lib/opportunities/precision";
import {
  emptyOfficialTransmissionContext,
  strategicTransmissionScore,
  type OfficialTransmissionContext,
} from "@/lib/opportunities/transmission-context";
import {
  evaluateOpportunityScreening,
  type OpportunityCandidate,
  type ScreeningCriteria,
  type ScreeningResult,
} from "@/lib/opportunities/screening";
import type { ExclusionBreakdown } from "@/lib/opportunities/contiguous-geometry";
import type { TerrainMetrics } from "@/lib/opportunities/terrain";

export const RANKING_WEIGHTS_V2 = {
  version: "suitability-v2",
  contiguousUsableArea: 0.35,
  environmental: 0.15,
  terrain: 0.15,
  landCover: 0.1,
  road: 0.1,
  gridContext: 0.1,
  dataCompleteness: 0.05,
} as const;

/**
 * Ranking V3 — relative investigation priority, not scientific precision.
 * Hard constraints are a filter, not a weight.
 * Detailed evidence for a dimension replaces coarse evidence for that dimension.
 * Official county transmission context is strategic only and cannot outrank site evidence.
 */
export const RANKING_WEIGHTS_V3 = {
  version: "suitability-v3",
  physicalContiguousArea: 0.3,
  physicalTerrain: 0.12,
  physicalLandCover: 0.1,
  environmental: 0.14,
  access: 0.1,
  gridContext: 0.12,
  dataCompleteness: 0.08,
  strategicContext: 0.04,
} as const;

export const RANKING_WEIGHTS_V4 = {
  version: RANKING_VERSION,
  targetFit: 0.28,
  geometryQuality: 0.1,
  physicalTerrain: 0.12,
  physicalLandCover: 0.12,
  environmental: 0.14,
  access: 0.08,
  gridContext: 0.08,
  dataCompleteness: 0.08,
} as const;

export type ScreeningCellRow = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  gross_area_ha: number | string | null;
  usable_area_ha: number | string | null;
  contiguous_area_ha?: number | string | null;
  protected_overlap_pct: number | string | null;
  natura_overlap_pct: number | string | null;
  protected_names: string[] | null;
  natura_names: string[] | null;
  local_covering_name: string | null;
  nup_covering_name: string | null;
  covering_queried: boolean | null;
  protected_queried: boolean | null;
  natura_queried: boolean | null;
  mean_slope_deg?: number | string | null;
  p90_slope_deg?: number | string | null;
  median_slope_deg?: number | string | null;
  pct_below_slope?: number | string | null;
  terrain_queried?: boolean | null;
  land_cover_queried?: boolean | null;
  land_cover?: LandCoverComposition | null;
  road_distance_m?: number | string | null;
  road_class?: string | null;
  road_queried?: boolean | null;
  exclusion_breakdown?: ExclusionBreakdown | null;
  screening_stage?: string | null;
  refinement_status?: string | null;
  discovery_rank?: number | string | null;
  detailed_rank?: number | string | null;
  terrain_resolution?: string | null;
  land_cover_resolution?: string | null;
  terrain_provider_key?: string | null;
  land_cover_provider_key?: string | null;
  transmission?: OfficialTransmissionContext | null;
  discovery_contiguous_area_ha?: number | string | null;
  compactness?: number | string | null;
  geometry_quality?: string | null;
  target_fit_score?: number | string | null;
  candidate_kind?: string | null;
};

function num(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function screeningCellToCandidate(
  row: ScreeningCellRow,
  criteria: ScreeningCriteria,
): OpportunityCandidate {
  const terrainQueried = row.terrain_queried === true;
  const terrain: TerrainMetrics | undefined = terrainQueried
    ? {
        queried: true,
        meanSlopeDeg: num(row.mean_slope_deg),
        medianSlopeDeg: num(row.median_slope_deg),
        p90SlopeDeg: num(row.p90_slope_deg),
        maxSlopeDeg: null,
        pctBelowThreshold: num(row.pct_below_slope),
        sourceName:
          row.terrain_provider_key === "lantmateriet-dtm-1m"
            ? "Lantmäteriet Markhöjdmodell 1 m"
            : "Copernicus DEM GLO-90",
        providerKey: row.terrain_provider_key ?? "copernicus-dem-glo90",
        resolution: (row.terrain_resolution as EvidenceResolution | undefined) ?? "coarse",
      }
    : undefined;
  const landCoverKey = row.land_cover_provider_key ?? "nv-nmd-2018";
  return {
    name: row.name,
    country: criteria.country,
    region: criteria.region,
    municipality: criteria.municipality,
    latitude: row.latitude,
    longitude: row.longitude,
    targetMw: criteria.targetMw,
    targetMwh: criteria.targetMwh,
    siteAreaHa: num(row.gross_area_ha),
    usableAreaHa: num(row.usable_area_ha),
    contiguousUsableAreaHa: num(row.contiguous_area_ha) ?? num(row.usable_area_ha),
    technology: criteria.technology,
    covering: {
      queried: row.covering_queried === true,
      localCovered: Boolean(row.local_covering_name),
      nupCovered: Boolean(row.nup_covering_name),
      localName: row.local_covering_name,
      nupName: row.nup_covering_name,
      retrievedAt: new Date().toISOString(),
      sourceName: "Energimarknadsinspektionen",
    },
    protectedOverlap: {
      queried: row.protected_queried === true,
      overlapPercent: num(row.protected_overlap_pct),
      names: row.protected_names ?? [],
      sourceName: "Naturvårdsverket",
    },
    naturaOverlap: {
      queried: row.natura_queried === true,
      overlapPercent: num(row.natura_overlap_pct),
      names: row.natura_names ?? [],
      sourceName: "Naturvårdsverket",
    },
    terrain,
    landCover: row.land_cover_queried
      ? {
          queried: true,
          composition: row.land_cover ?? emptyLandCoverComposition(),
          sourceName:
            landCoverKey === "nv-nmd-2023"
              ? "Naturvårdsverket NMD 2023 v0.3"
              : "Naturvårdsverket NMD 2018 (legacy fallback)",
        }
      : undefined,
    road: row.road_queried
      ? {
          queried: true,
          nearestDistanceM: num(row.road_distance_m),
          nearestClass: row.road_class ?? null,
          sourceName: "Trafikverket NVDB / INSPIRE TN",
        }
      : undefined,
    exclusionBreakdown: row.exclusion_breakdown ?? null,
  };
}

export type RankedCellAssessment = {
  id: string;
  rank: number | null;
  discoveryRank: number | null;
  detailedRank: number | null;
  recommendation: OpportunityRecommendationValue;
  recommendationSummary: string;
  dataConfidence: ScreeningResult["dataConfidence"];
  excluded: boolean;
  exclusionReason: string | null;
  keyPositive: string | null;
  keyRisk: string | null;
  screening: ScreeningResult;
  relativeScore: number;
  strategicFlags: StrategicFlag[];
  rankChangeExplanation: string | null;
};

type AssessedArea = {
  id: string;
  contiguousHa: number;
  screening: ScreeningResult;
  row: ScreeningCellRow;
  relativeScore: number;
};

function coveringScore(row: ScreeningCellRow): number {
  if (row.local_covering_name && row.nup_covering_name) return 1;
  if (row.local_covering_name || row.nup_covering_name) return 0.6;
  if (row.covering_queried) return 0.2;
  return 0;
}

function environmentalScore(row: ScreeningCellRow, screening: ScreeningResult): number {
  if (screening.dimensions.find((item) => item.key === "environmental")?.result === "excluded") {
    return 0;
  }
  const prot = num(row.protected_overlap_pct) ?? 0;
  const nat = num(row.natura_overlap_pct) ?? 0;
  if (!row.protected_queried && !row.natura_queried) return 0;
  return Math.max(0, 1 - (prot + nat) / 100);
}

function terrainScore(row: ScreeningCellRow): number {
  if (row.terrain_queried !== true) return 0;
  const pct = num(row.pct_below_slope);
  if (pct == null) return 0;
  return Math.min(1, Math.max(0, pct / 100));
}

function landCoverScore(row: ScreeningCellRow, criteria: ScreeningCriteria): number {
  if (row.land_cover_queried !== true || !row.land_cover) return 0;
  const profile = parseLandCoverProfile(criteria.landCoverProfile);
  let preferred = 0;
  let deprioritised = 0;
  for (const [group, share] of Object.entries(row.land_cover)) {
    const rule = profile[group as keyof typeof profile];
    if (rule === "preferred") preferred += share;
    if (rule === "deprioritised") deprioritised += share;
  }
  return Math.min(1, Math.max(0, 0.5 + (preferred - deprioritised) / 200));
}

function roadScore(row: ScreeningCellRow, criteria: ScreeningCriteria): number {
  if (row.road_queried !== true) return 0;
  const distance = num(row.road_distance_m);
  if (distance == null) return 0;
  const maxM = criteria.maxRoadDistanceM ?? (criteria.maxDistanceKm != null ? criteria.maxDistanceKm * 1000 : 1000);
  if (distance <= 0) return 1;
  if (distance >= maxM * 2) return 0;
  return Math.max(0, 1 - distance / (maxM * 2));
}

function completenessScore(screening: ScreeningResult): number {
  const available = screening.dimensions.filter((item) => item.completeness === "available").length;
  return Math.min(1, available / screening.dimensions.length);
}

export function suitabilityScoreV4(
  row: ScreeningCellRow,
  screening: ScreeningResult,
  criteria: ScreeningCriteria,
): number {
  if (screening.excluded) return 0;
  const profile = resolveSiteAreaProfile({
    minSiteAreaHa: criteria.minSiteAreaHa,
    targetSiteAreaHa: criteria.targetSiteAreaHa,
    maxCandidateAreaHa: criteria.maxCandidateAreaHa,
    maxReturnedCandidates: criteria.maxReturnedCandidates,
  });
  const usable = num(row.contiguous_area_ha) ?? num(row.usable_area_ha) ?? 0;
  const fit = num(row.target_fit_score) ?? targetFitAssessment(usable, profile).score;
  const compact = num(row.compactness);
  const geometry =
    row.geometry_quality === "review" ? 0.45 : compact == null ? 0.7 : Math.max(0, Math.min(1, compact / 0.9));
  const weights = RANKING_WEIGHTS_V4;
  return (
    weights.targetFit * fit +
    weights.geometryQuality * geometry +
    weights.physicalTerrain * terrainScore(row) +
    weights.physicalLandCover * landCoverScore(row, criteria) +
    weights.environmental * environmentalScore(row, screening) +
    weights.access * roadScore(row, criteria) +
    weights.gridContext * coveringScore(row) +
    weights.dataCompleteness * completenessScore(screening)
  );
}

export function suitabilityScoreV3(
  row: ScreeningCellRow,
  screening: ScreeningResult,
  criteria: ScreeningCriteria,
  maxContiguousHa: number,
): number {
  if (screening.excluded) return 0;
  const contiguous = num(row.contiguous_area_ha) ?? num(row.usable_area_ha) ?? 0;
  const area = maxContiguousHa > 0 ? contiguous / maxContiguousHa : 0;
  const weights = RANKING_WEIGHTS_V3;
  const transmission = row.transmission ?? emptyOfficialTransmissionContext();
  return (
    weights.physicalContiguousArea * area +
    weights.physicalTerrain * terrainScore(row) +
    weights.physicalLandCover * landCoverScore(row, criteria) +
    weights.environmental * environmentalScore(row, screening) +
    weights.access * roadScore(row, criteria) +
    weights.gridContext * coveringScore(row) +
    weights.dataCompleteness * completenessScore(screening) +
    weights.strategicContext * strategicTransmissionScore(transmission)
  );
}

export function suitabilityScoreV2(
  row: ScreeningCellRow,
  screening: ScreeningResult,
  criteria: ScreeningCriteria,
  maxContiguousHa: number,
): number {
  if (screening.excluded) return 0;
  const contiguous = num(row.contiguous_area_ha) ?? num(row.usable_area_ha) ?? 0;
  const area = maxContiguousHa > 0 ? contiguous / maxContiguousHa : 0;
  const weights = RANKING_WEIGHTS_V2;
  return (
    weights.contiguousUsableArea * area +
    weights.environmental * environmentalScore(row, screening) +
    weights.terrain * terrainScore(row) +
    weights.landCover * landCoverScore(row, criteria) +
    weights.road * roadScore(row, criteria) +
    weights.gridContext * coveringScore(row) +
    weights.dataCompleteness * completenessScore(screening)
  );
}

export function explainWhyARanksAboveB(left: AssessedArea, right: AssessedArea): string {
  const reasons: string[] = [];
  const leftFit = num(left.row.target_fit_score);
  const rightFit = num(right.row.target_fit_score);
  if (leftFit != null && rightFit != null && Math.abs(leftFit - rightFit) >= 0.05) {
    reasons.push(
      leftFit > rightFit
        ? "closer fit to the configured target site area"
        : "weaker fit to the configured target site area",
    );
  }
  const areaDelta = left.contiguousHa - right.contiguousHa;
  if (Math.abs(areaDelta) >= 0.1 && Math.abs(areaDelta) < 80) {
    reasons.push(
      areaDelta > 0
        ? `${left.row.name} has ${areaDelta.toFixed(1)} ha more contiguous usable area within the target band`
        : `${right.row.name} has ${Math.abs(areaDelta).toFixed(1)} ha more contiguous usable area within the target band`,
    );
  }
  const leftEnv = left.screening.dimensions.find((item) => item.key === "environmental");
  const rightEnv = right.screening.dimensions.find((item) => item.key === "environmental");
  if (leftEnv && rightEnv && leftEnv.result !== rightEnv.result) {
    reasons.push(`environmental result ${leftEnv.result} vs ${rightEnv.result}`);
  }
  const leftSlope = num(left.row.p90_slope_deg);
  const rightSlope = num(right.row.p90_slope_deg);
  if (leftSlope != null && rightSlope != null && Math.abs(leftSlope - rightSlope) >= 0.3) {
    reasons.push(
      leftSlope < rightSlope ? "lower terrain constraint (P90 slope)" : "higher terrain constraint (P90 slope)",
    );
  }
  const leftRoad = num(left.row.road_distance_m);
  const rightRoad = num(right.row.road_distance_m);
  if (leftRoad != null && rightRoad != null && Math.abs(leftRoad - rightRoad) >= 50) {
    reasons.push(
      leftRoad < rightRoad
        ? `closer supported road proximity (${Math.round(leftRoad)} m vs ${Math.round(rightRoad)} m)`
        : `farther supported road proximity`,
    );
  }
  const leftCover = coveringScore(left.row);
  const rightCover = coveringScore(right.row);
  if (leftCover === rightCover) {
    reasons.push("similar official grid context");
  } else if (leftCover > rightCover) {
    reasons.push("stronger official covering geography at the centroid");
  }
  if (reasons.length === 0) {
    reasons.push("higher relative investigation priority from the versioned suitability-v4 target-fit weights");
  }
  return `${left.row.name} ranks above ${right.row.name} based on currently supported evidence: ${reasons.join("; ")}. This is not a prediction of permitting or connection. County-level official transmission indications are not site capacity.`;
}

export function rankScreeningCells(
  rows: ScreeningCellRow[],
  criteria: ScreeningCriteria,
): RankedCellAssessment[] {
  const assessed: AssessedArea[] = rows.map((row) => {
    const screening = evaluateOpportunityScreening({
      criteria,
      candidate: screeningCellToCandidate(row, criteria),
    });
    return {
      id: row.id,
      contiguousHa: num(row.contiguous_area_ha) ?? num(row.usable_area_ha) ?? 0,
      screening,
      row,
      relativeScore: 0,
    };
  });
  for (const item of assessed) {
    item.relativeScore = suitabilityScoreV4(item.row, item.screening, criteria);
  }

  const passing = assessed
    .filter((item) => !item.screening.excluded)
    .sort((left, right) => {
      const rec = recommendationRank(left.screening.recommendation) - recommendationRank(right.screening.recommendation);
      if (rec !== 0) return rec;
      if (right.relativeScore !== left.relativeScore) return right.relativeScore - left.relativeScore;
      return right.contiguousHa - left.contiguousHa;
    });
  const excluded = assessed.filter((item) => item.screening.excluded);
  const ordered = [...passing, ...excluded];
  const leader = passing[0] ?? null;
  const runnerUp = passing[1] ?? null;

  return ordered.map((item, index) => {
    const why =
      leader && runnerUp && item.id === leader.id
        ? explainWhyARanksAboveB(leader, runnerUp)
        : null;
    const summary =
      !item.screening.excluded && index === 0 && passing.length > 0
        ? `Priority #1 for further investigation. ${why ?? item.screening.recommendationSummary}`
        : item.screening.recommendationSummary;
    const rank = item.screening.excluded ? null : passing.findIndex((row) => row.id === item.id) + 1;
    const discoveryRank = num(item.row.discovery_rank);
    const isDetailed = item.row.refinement_status === "refined";
    const flags = deriveStrategicFlags({
      contiguousHa: item.contiguousHa,
      minAreaHa: criteria.minSiteAreaHa,
      terrainFavorable: (num(item.row.pct_below_slope) ?? 0) >= 80,
      environmentalConflict:
        (num(item.row.protected_overlap_pct) ?? 0) >= 1 || (num(item.row.natura_overlap_pct) ?? 0) >= 1,
      roadDistanceM: num(item.row.road_distance_m),
      maxRoadDistanceM: criteria.maxRoadDistanceM ?? null,
      localCovered: Boolean(item.row.local_covering_name),
      nupCovered: Boolean(item.row.nup_covering_name),
      transmissionAvailable: item.row.transmission?.available === true,
      highApplicationVolume: (item.row.transmission?.appliedMw ?? 0) >= 500,
      criticalGap: item.screening.dataConfidence === "unknown" || item.screening.dataConfidence === "low",
    });
    return {
      id: item.id,
      rank,
      discoveryRank: discoveryRank ?? (isDetailed ? discoveryRank : rank),
      detailedRank: isDetailed ? rank : num(item.row.detailed_rank),
      recommendation: item.screening.recommendation,
      recommendationSummary: summary,
      dataConfidence: item.screening.dataConfidence,
      excluded: item.screening.excluded,
      exclusionReason: item.screening.exclusionReason,
      keyPositive: item.screening.positives[0] ?? null,
      keyRisk: item.screening.risks[0] ?? null,
      screening: {
        ...item.screening,
        recommendationSummary: summary,
        uncertainties: why
          ? [...item.screening.uncertainties, why]
          : item.screening.uncertainties,
      },
      relativeScore: item.relativeScore,
      strategicFlags: flags,
      rankChangeExplanation: explainRankChange({
        name: item.row.name,
        discoveryRank: discoveryRank ?? rank,
        detailedRank: isDetailed ? rank : null,
        discoveryContiguousHa: num(item.row.discovery_contiguous_area_ha),
        refinedContiguousHa: isDetailed ? item.contiguousHa : null,
      }),
    };
  });
}
