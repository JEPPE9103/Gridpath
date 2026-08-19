import { getPortfolioOverview } from "@/lib/data/overview";
import { OverviewPage } from "@/features/overview/overview-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const overview = await getPortfolioOverview();
  return <OverviewPage overview={overview} />;
}
