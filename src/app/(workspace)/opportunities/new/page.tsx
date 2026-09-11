import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { OpportunityForm } from "@/features/opportunities/opportunity-form";
import { getCurrentOrganization } from "@/lib/data/organization";
import { getOpportunityScreeningProfiles } from "@/lib/data/screening-profiles";
import { createOpportunityAction } from "@/lib/opportunities/actions";
import { canCreateOrEditOpportunities } from "@/lib/opportunities/authorization";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "New opportunity search" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const organization = await getCurrentOrganization();
  const canWrite = canCreateOrEditOpportunities(organization?.role);
  const profiles = canWrite ? await getOpportunityScreeningProfiles() : [];

  return (
    <>
      <PageHeader
        eyebrow="Discover"
        title="New opportunity search"
        subtitle="Profile-first geographic screening. Candidate Sites are investigation footprints, not land parcels or approved projects."
      />
      <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        {canWrite ? (
          <OpportunityForm action={createOpportunityAction} profiles={profiles} />
        ) : (
          <EmptyState
            title="You cannot create opportunities"
            description="Opportunity screening is limited to owner, admin and member roles."
          />
        )}
      </div>
    </>
  );
}
