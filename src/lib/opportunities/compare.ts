import type { OpportunityRecommendationValue } from "@/lib/opportunities/catalog";

export const MAX_OPPORTUNITY_COMPARISON = 4;

export function canCompareOpportunities(count: number): { ok: true } | { ok: false; error: string } {
  if (count < 2) {
    return { ok: false, error: "Select at least two opportunities to compare." };
  }
  if (count > MAX_OPPORTUNITY_COMPARISON) {
    return { ok: false, error: "Compare up to four opportunities at a time." };
  }
  return { ok: true };
}

export function recommendationRank(value: OpportunityRecommendationValue): number {
  switch (value) {
    case "prioritise":
      return 0;
    case "investigate":
      return 1;
    case "secondary":
      return 2;
    case "low_priority":
      return 3;
    default:
      return 4;
  }
}

export function compareRecommendation(
  left: OpportunityRecommendationValue,
  right: OpportunityRecommendationValue,
): number {
  return recommendationRank(left) - recommendationRank(right);
}
