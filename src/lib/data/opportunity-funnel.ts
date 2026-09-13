export type OpportunityFunnel = {
  searches: number;
  total: number;
  identified: number;
  screening: number;
  strongCandidates: number;
  underReview: number;
  shortlisted: number;
  rejected: number;
  promoted: number;
};

export const EMPTY_OPPORTUNITY_FUNNEL: OpportunityFunnel = {
  searches: 0,
  total: 0,
  identified: 0,
  screening: 0,
  strongCandidates: 0,
  underReview: 0,
  shortlisted: 0,
  rejected: 0,
  promoted: 0,
};

export function opportunityFunnelFromStatuses(
  statuses: readonly string[],
  searches: number,
): OpportunityFunnel {
  const funnel = { ...EMPTY_OPPORTUNITY_FUNNEL, searches };
  for (const status of statuses) {
    funnel.total += 1;
    if (status === "identified") funnel.identified += 1;
    if (status === "screening") funnel.screening += 1;
    if (status === "strong_candidate") funnel.strongCandidates += 1;
    if (status === "under_review") funnel.underReview += 1;
    if (status === "shortlisted") funnel.shortlisted += 1;
    if (status === "rejected") funnel.rejected += 1;
    if (status === "promoted") funnel.promoted += 1;
  }
  return funnel;
}
