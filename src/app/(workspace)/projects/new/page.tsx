import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectForm } from "@/features/projects/project-form";
import { listGridOperators } from "@/lib/data/grid-operators";
import { getCurrentOrganization } from "@/lib/data/organization";
import { createProjectAction } from "@/lib/projects/actions";
import { canCreateOrEditProjects } from "@/lib/projects/authorization";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Add project" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const organization = await getCurrentOrganization();
  const canWrite = canCreateOrEditProjects(organization?.role);
  const operators = canWrite ? await listGridOperators() : [];

  return (
    <>
      <PageHeader
        title="Add project"
        subtitle="Create a development project with a primary site coordinate."
      />
      <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        {canWrite ? (
          <ProjectForm
            action={createProjectAction}
            operators={operators}
            submitLabel="Create project"
            cancelHref="/portfolio"
          />
        ) : (
          <EmptyState
            title="You cannot add projects"
            description="Project creation is limited to owner, admin and member roles."
          />
        )}
      </div>
    </>
  );
}
