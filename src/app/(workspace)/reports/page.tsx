import { getPortfolioReportForCurrentOrganization } from "@/lib/data/report";
import { ReportsPage } from "@/features/reports/reports-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const result = await getPortfolioReportForCurrentOrganization();
  return <ReportsPage result={result} />;
}
