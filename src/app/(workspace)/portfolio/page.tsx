import { listProjects } from "@/lib/data/projects";
import { getCurrentOrganization } from "@/lib/data/organization";
import { PortfolioPage } from "@/features/portfolio/portfolio-page";
import { canCreateOrEditProjects } from "@/lib/projects/authorization";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Portfolio" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [{ projects, blockedByRls, error }, organization] = await Promise.all([
    listProjects(),
    getCurrentOrganization(),
  ]);
  return (
    <PortfolioPage
      projects={projects}
      blockedByRls={blockedByRls}
      error={error}
      canCreate={canCreateOrEditProjects(organization?.role)}
    />
  );
}
