import { listProjects } from "@/lib/data/projects";
import { getOrganizationProjectAggregates } from "@/lib/data/project-aggregates";
import { getCurrentOrganization } from "@/lib/data/organization";
import { PortfolioPage } from "@/features/portfolio/portfolio-page";
import { canCreateOrEditProjects, canImportProjects } from "@/lib/projects/authorization";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Portfolio" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = {
    view: first(params.view),
    q: first(params.q),
    technology: first(params.technology),
    operator: first(params.operator),
    stage: first(params.stage),
    outlook: first(params.outlook),
    page: first(params.page),
    sort: first(params.sort),
    dir: first(params.dir),
  };

  const [list, organization, aggregatesResult] = await Promise.all([
    listProjects(query),
    getCurrentOrganization(),
    getOrganizationProjectAggregates(false),
  ]);

  return (
    <PortfolioPage
      result={list}
      activeCount={aggregatesResult.aggregates.activeCount}
      archivedCount={aggregatesResult.aggregates.archivedCount}
      activeMw={aggregatesResult.aggregates.activeMw}
      blockedByRls={list.blockedByRls}
      error={list.error ?? aggregatesResult.error}
      canCreate={canCreateOrEditProjects(organization?.role)}
      canImport={canImportProjects(organization?.role)}
    />
  );
}

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}
