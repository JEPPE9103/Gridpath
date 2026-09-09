import { OpportunityComparePage } from "@/features/opportunities/opportunity-compare";
import { getOpportunityBySlug, listOpportunitiesForCurrentOrganization } from "@/lib/data/opportunities";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Compare opportunities" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const params = await searchParams;
  const ids = (params.ids ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 4);
  const list = await listOpportunitiesForCurrentOrganization();
  const items = list.items.filter((item) => ids.includes(item.id));
  const details = await Promise.all(items.map((item) => getOpportunityBySlug(item.slug)));
  const assessmentsById = new Map(
    details
      .filter((detail) => detail.item)
      .map((detail) => [detail.item!.id, detail.assessments]),
  );
  return <OpportunityComparePage items={items} assessmentsById={assessmentsById} />;
}
