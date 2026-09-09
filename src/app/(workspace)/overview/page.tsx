import { getPortfolioOverview } from "@/lib/data/overview";
import { getOpportunityFunnel } from "@/lib/data/opportunities";
import { OverviewPage } from "@/features/overview/overview-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [overview, funnel] = await Promise.all([
    getPortfolioOverview(),
    getOpportunityFunnel(),
  ]);
  return <OverviewPage overview={overview} funnel={funnel} />;
}
