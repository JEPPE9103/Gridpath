import { OpportunitySearchResults } from "@/features/opportunities/opportunity-search-results";
import { getOpportunitySearchRun } from "@/lib/data/opportunity-runs";
import { getCurrentOrganization } from "@/lib/data/organization";
import { canCreateOrEditOpportunities } from "@/lib/opportunities/authorization";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Opportunity search results" };

export default async function Page({
  params,
}: {
  params: Promise<{ searchId: string; runId: string }>;
}) {
  const { searchId, runId } = await params;
  const [view, organization] = await Promise.all([
    getOpportunitySearchRun(searchId, runId),
    getCurrentOrganization(),
  ]);
  if (!view) {
    notFound();
  }

  return (
    <OpportunitySearchResults
      view={view}
      canWrite={canCreateOrEditOpportunities(organization?.role)}
    />
  );
}
