import { rankScreeningCells, type ScreeningCellRow } from "../../src/lib/opportunities/run-ranking";
import { RANKING_VERSION } from "../../src/lib/opportunities/screening-profiles";
import { NOXHEIM_DEFAULT_LAND_COVER_PROFILE } from "../../src/lib/opportunities/land-cover";
import type { ScreeningCriteria } from "../../src/lib/opportunities/screening";

export function demoScreeningCriteria(input: {
  region: string | null;
  municipality: string | null;
}): ScreeningCriteria {
  return {
    technology: "battery_storage",
    country: "SE",
    region: input.region,
    municipality: input.municipality,
    targetMw: null,
    targetMwh: null,
    minSiteAreaHa: 8,
    targetSiteAreaHa: 15,
    maxCandidateAreaHa: 30,
    maxReturnedCandidates: 25,
    maxDistanceKm: null,
    excludeProtected: true,
    excludeNatura: true,
    maxSlopePercent: null,
    maxSlopeDegrees: 5,
    slopeMode: "preference",
    landCoverProfile: { ...NOXHEIM_DEFAULT_LAND_COVER_PROFILE },
    maxRoadDistanceM: 1000,
    roadMode: "preference",
    minDistanceResidentialM: null,
    electricityArea: null,
    notes: null,
    rankingVersion: RANKING_VERSION,
  };
}

export function rankDemoRunCandidates(rows: ScreeningCellRow[], criteria: ScreeningCriteria) {
  return rankScreeningCells(rows, criteria).map((item) => ({
    id: item.id,
    rank: item.rank,
    discoveryRank: item.discoveryRank,
    recommendation: item.recommendation,
    recommendationSummary: item.recommendationSummary,
    dataConfidence: item.dataConfidence,
    excluded: item.excluded,
    exclusionReason: item.exclusionReason,
    keyPositive: item.keyPositive,
    keyRisk: item.keyRisk,
    screening: { ...item.screening, intelligence: item.intelligence },
    rankingVersion: RANKING_VERSION,
    strategicFlags: item.strategicFlags,
    rankChangeExplanation: item.rankChangeExplanation,
  }));
}
