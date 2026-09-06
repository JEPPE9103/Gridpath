import { CompareListPage } from "@/features/compare/compare-list-page";
import { getSavedComparisonsForCurrentOrganization } from "@/lib/data/portfolio-comparisons";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Saved comparisons" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const result = await getSavedComparisonsForCurrentOrganization();
  return <CompareListPage result={result} />;
}
