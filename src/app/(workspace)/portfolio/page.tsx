import { listProjects } from "@/lib/data/projects";
import { getOrganizationProjectAggregates } from "@/lib/data/project-aggregates";
import { getCurrentOrganization } from "@/lib/data/organization";
import { loadOrganizationAttentionInputs } from "@/lib/data/project-attention-load";
import { PORTFOLIO_PAGE_SIZE } from "@/lib/data/paged-select";
import { PortfolioPage } from "@/features/portfolio/portfolio-page";
import {
  matchesPortfolioAttentionFilter,
  projectAttentionById,
} from "@/lib/intelligence/portfolio-attention";
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
    attention: first(params.attention),
  };

  const [list, organization, aggregatesResult, attentionLoad] = await Promise.all([
    listProjects(query),
    getCurrentOrganization(),
    getOrganizationProjectAggregates(false),
    loadOrganizationAttentionInputs(),
  ]);

  const attentionMap = projectAttentionById(attentionLoad.inputs);
  const unreviewedById = new Map(
    attentionLoad.inputs.map((item) => [item.id, item.unreviewedOfficialChangeCount ?? 0]),
  );
  const withAttention = list.projects.map((project) => {
    const attention = attentionMap.get(project.projectId);
    return {
      ...project,
      attentionBand: attention?.band,
      nextActionTitle: attention?.nextAction.title,
      daysInCurrentStage: attention?.daysInCurrentStage ?? null,
      unreviewedOfficialChangeCount: unreviewedById.get(project.projectId) ?? 0,
    };
  });

  const filtered =
    list.attentionFilter === "all"
      ? withAttention
      : withAttention.filter((project) => {
          const attention = attentionMap.get(project.projectId);
          if (!attention || attention.band === "clear") {
            return false;
          }
          return matchesPortfolioAttentionFilter(
            { band: attention.band, signals: attention.signals },
            list.attentionFilter,
          );
        });

  const sorted =
    list.sortKey === "attention"
      ? [...filtered].sort((left, right) => {
          const leftRank = rankBand(left.attentionBand);
          const rightRank = rankBand(right.attentionBand);
          if (leftRank !== rightRank) {
            return leftRank - rightRank;
          }
          return left.name.localeCompare(right.name, "sv");
        })
      : filtered;

  const paginate = list.sortKey === "attention" || list.attentionFilter !== "all";
  const matchingCount = paginate ? sorted.length : list.matchingCount;
  const page = list.page;
  const paged = paginate
    ? sorted.slice((page - 1) * PORTFOLIO_PAGE_SIZE, page * PORTFOLIO_PAGE_SIZE)
    : sorted;

  return (
    <PortfolioPage
      result={{
        ...list,
        projects: paged,
        matchingCount,
        error: list.error ?? attentionLoad.error,
      }}
      activeCount={aggregatesResult.aggregates.activeCount}
      archivedCount={aggregatesResult.aggregates.archivedCount}
      activeMw={aggregatesResult.aggregates.activeMw}
      blockedByRls={list.blockedByRls}
      error={list.error ?? aggregatesResult.error ?? attentionLoad.error}
      canCreate={canCreateOrEditProjects(organization?.role)}
      canImport={canImportProjects(organization?.role)}
    />
  );
}

function rankBand(band: "action" | "attention" | "review" | "clear" | undefined): number {
  switch (band) {
    case "action":
      return 0;
    case "attention":
      return 1;
    case "review":
      return 2;
    default:
      return 3;
  }
}

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}
