import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectForm } from "@/features/projects/project-form";
import { listGridOperators } from "@/lib/data/grid-operators";
import { getCurrentOrganization } from "@/lib/data/organization";
import { getProjectFormBySlug } from "@/lib/data/project-form";
import { updateProjectAction } from "@/lib/projects/actions";
import { canCreateOrEditProjects } from "@/lib/projects/authorization";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const record = await getProjectFormBySlug(slug);
  return { title: record ? `Edit ${record.values.name}` : "Edit project" };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const organization = await getCurrentOrganization();
  const record = await getProjectFormBySlug(slug);
  if (!record) {
    notFound();
  }

  const canWrite = canCreateOrEditProjects(organization?.role);
  const operators = canWrite ? await listGridOperators() : [];
  const action = updateProjectAction.bind(null, record.id);

  return (
    <>
      <PageHeader
        title={`Edit ${record.values.name}`}
        subtitle="Update project details and the primary site coordinate."
      />
      <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        {canWrite ? (
          <ProjectForm
            action={action}
            operators={operators}
            defaults={record.values}
            submitLabel="Save changes"
            cancelHref={`/projects/${record.slug}`}
          />
        ) : (
          <EmptyState
            title="You cannot edit this project"
            description="Project editing is limited to owner, admin and member roles."
          />
        )}
      </div>
    </>
  );
}
