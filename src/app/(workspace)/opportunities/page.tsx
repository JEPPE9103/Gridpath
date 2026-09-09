import { getOpportunityOverview } from "@/lib/data/opportunities";
import { OpportunitiesPage } from "@/features/opportunities/opportunities-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Opportunities" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const overview = await getOpportunityOverview();
  return <OpportunitiesPage overview={overview} />;
}
