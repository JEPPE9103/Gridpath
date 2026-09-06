import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PortfolioImportWizard } from "@/features/portfolio/import-wizard";
import { getCurrentOrganization } from "@/lib/data/organization";
import { canImportProjects } from "@/lib/projects/authorization";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Import projects" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const organization = await getCurrentOrganization();
  const canImport = canImportProjects(organization?.role);

  return (
    <>
      <PageHeader
        title="Import projects"
        subtitle="Create a portfolio from a CSV or XLSX file using standard Noxheim project fields."
      />
      <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        {canImport ? (
          <PortfolioImportWizard />
        ) : (
          <EmptyState
            title="You cannot import projects"
            description="Portfolio import is limited to owner, admin and member roles."
          />
        )}
      </div>
    </>
  );
}
