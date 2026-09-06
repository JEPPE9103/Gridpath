import { CompareDetailPage } from "@/features/compare/compare-detail-page";
import { getSavedComparisonById } from "@/lib/data/portfolio-comparisons";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Saved comparison" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) {
    notFound();
  }
  const result = await getSavedComparisonById(id);
  return <CompareDetailPage result={result} />;
}
