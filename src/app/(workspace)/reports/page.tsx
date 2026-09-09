import { getPortfolioReportForCurrentOrganization } from "@/lib/data/report";
import { getOpportunityFunnel } from "@/lib/data/opportunities";
import { ReportsPage } from "@/features/reports/reports-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [result, funnel] = await Promise.all([
    getPortfolioReportForCurrentOrganization(),
    getOpportunityFunnel(),
  ]);
  return <ReportsPage result={result} funnel={funnel} />;
}
