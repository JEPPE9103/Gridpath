import type { OpportunityRecommendationValue } from "@/lib/opportunities/catalog";
import { recommendationRank } from "@/lib/opportunities/compare";
import {
  evaluateOpportunityScreening,
  type OpportunityCandidate,
  type ScreeningCriteria,
  type ScreeningResult,
} from "@/lib/opportunities/screening";

export type ScreeningCellRow = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  gross_area_ha: number | string | null;
  usable_area_ha: number | string | null;
  protected_overlap_pct: number | string | null;
  natura_overlap_pct: number | string | null;
  protected_names: string[] | null;
  natura_names: string[] | null;
  local_covering_name: string | null;
  nup_covering_name: string | null;
  covering_queried: boolean | null;
  protected_queried: boolean | null;
  natura_queried: boolean | null;
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
  };
}

export type RankedCellAssessment = {
  id: string;
  rank: number | null;
  recommendation: OpportunityRecommendationValue;
  recommendationSummary: string;
  dataConfidence: ScreeningResult["dataConfidence"];
  excluded: boolean;
  exclusionReason: string | null;
  keyPositive: string | null;
  keyRisk: string | null;
  screening: ScreeningResult;
};

export function rankScreeningCells(
  rows: ScreeningCellRow[],
  criteria: ScreeningCriteria,
): RankedCellAssessment[] {
  const assessed = rows.map((row) => {
    const screening = evaluateOpportunityScreening({
      criteria,
      candidate: screeningCellToCandidate(row, criteria),
    });
    return { id: row.id, usableAreaHa: num(row.usable_area_ha) ?? 0, screening };
  });

  const passing = assessed
    .filter((item) => !item.screening.excluded)
    .sort((left, right) => {
      const rec = recommendationRank(left.screening.recommendation) - recommendationRank(right.screening.recommendation);
      if (rec !== 0) return rec;
      return right.usableAreaHa - left.usableAreaHa;
    });
  const excluded = assessed.filter((item) => item.screening.excluded);
  const ordered = [...passing, ...excluded];

  return ordered.map((item, index) => ({
    id: item.id,
    rank: item.screening.excluded ? null : index + 1,
    recommendation: item.screening.recommendation,
    recommendationSummary: item.screening.recommendationSummary,
    dataConfidence: item.screening.dataConfidence,
    excluded: item.screening.excluded,
    exclusionReason: item.screening.exclusionReason,
    keyPositive: item.screening.positives[0] ?? null,
    keyRisk: item.screening.risks[0] ?? null,
    screening: item.screening,
  }));
}
