import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { OpportunityDetailPage } from "@/features/opportunities/opportunity-detail";
import { getOpportunityBySlug } from "@/lib/data/opportunities";
import { getCurrentOrganization } from "@/lib/data/organization";
import { canCreateOrEditOpportunities } from "@/lib/opportunities/authorization";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getOpportunityBySlug(slug);
  if (result.kind !== "ok" || !result.item) {
    return { title: "Opportunity" };
  }
  return { title: result.item.name };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [result, organization] = await Promise.all([
    getOpportunityBySlug(slug),
    getCurrentOrganization(),
  ]);
  if (result.kind === "not_found") {
    notFound();
  }
  if (result.kind === "no_organization" || !result.item) {
    return (
      <>
        <PageHeader title="Opportunity" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState title="Could not load opportunity" description="Try again from Opportunities." />
        </div>
      </>
    );
  }
  return (
    <OpportunityDetailPage
      item={result.item}
      notes={result.notes}
      rejectionReason={result.rejectionReason}
      rejectionNote={result.rejectionNote}
      assessments={result.assessments}
      events={result.events}
      reassessmentNotices={result.reassessmentNotices}
      assessmentVersions={result.assessmentVersions}
      canWrite={canCreateOrEditOpportunities(organization?.role)}
    />
  );
}
