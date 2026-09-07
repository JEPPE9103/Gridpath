import { getCurrentOrganization } from "@/lib/data/organization";
import {
  EMPTY_OFFICIAL_CHANGE_COUNTS,
  type OverviewAlertItem,
  type OverviewKpis,
  type OverviewProject,
  type PortfolioOverview,
} from "@/lib/data/overview-types";
import { getOfficialChangeImpactCounts, getUnreviewedOfficialChangeCountsByProject } from "@/lib/data/grid-changes";
import { getOfficialSourceHealth } from "@/lib/data/source-health";
import { applyArchiveFilter } from "@/lib/data/archive-filter";
import { fetchAllQueryPages } from "@/lib/data/paged-select";
import { getOrganizationProjectAggregates } from "@/lib/data/project-aggregates";
import { listAllProjectsForOrganization } from "@/lib/data/projects";
import { applicationReadinessFromRequirements } from "@/lib/domain/application-readiness";
import { isOfficialSourceUpdateDelayed } from "@/lib/domain/official-change-summary";
import {
  checklistStatusLabel,
  confidenceLabel,
  connectionCaseStatusLabel,
  pipelineStageLabel,
} from "@/lib/domain/catalog-labels";
import { buildPortfolioAttention } from "@/lib/intelligence/portfolio-attention";
import type { PortfolioAttentionProjectInput } from "@/lib/intelligence/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AlertSeverity } from "@/types";

export type {
  OverviewAlertItem,
  OverviewKpis,
  OverviewPipelineStage,
  OverviewProject,
  PortfolioOverview,
} from "@/lib/data/overview-types";
export { OVERVIEW_PIPELINE_STAGES } from "@/lib/data/overview-types";

type ConnectionCaseRow = {
  project_id: string;
  stage: string;
  status: string;
};

type RequirementRow = {
  project_id: string;
  status: string;
  required: boolean;
  due_date: string | null;
};

type ProjectMetaRow = {
  id: string;
  slug: string;
  name: string;
  connection_stage: string;
  confidence: string;
  target_cod: string | null;
  updated_at: string;
  archived_at?: string | null;
};

type GridOperatorEmbed = { name: string };

type AlertProjectEmbed = {
  name: string;
  slug: string;
  archived_at: string | null;
  grid_operators: GridOperatorEmbed | GridOperatorEmbed[] | null;
};

type AlertRow = {
  id: string;
  severity: string;
  title: string;
  summary: string | null;
  detail: string | null;
  cta_label: string | null;
  href: string | null;
  created_at: string;
  project_id: string | null;
  projects: AlertProjectEmbed | AlertProjectEmbed[] | null;
};

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  positive: 3,
};

const EMPTY_PORTFOLIO_ATTENTION = { needsAttention: [], watch: [] };

const EMPTY_KPIS: OverviewKpis = {
  activeSites: 0,
  totalMW: 0,
  connectionEnquiries: 0,
  gridStudiesOpen: 0,
  needsAttention: 0,
};

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isAlertSeverity(value: string): value is AlertSeverity {
  return value === "critical" || value === "warning" || value === "info" || value === "positive";
}

function emptyOverview(
  kind: "no_organization" | "error",
  error: string | null,
  organizationName: string | null = null,
): PortfolioOverview {
  if (kind === "no_organization") {
    return {
      kind,
      organizationName: null,
      kpis: EMPTY_KPIS,
      alerts: [],
      projects: [],
      recentProjects: [],
      portfolioAttention: EMPTY_PORTFOLIO_ATTENTION,
      officialChanges: EMPTY_OFFICIAL_CHANGE_COUNTS,
      officialSourceDelayed: false,
      error: null,
    };
  }
  return {
    kind: "error",
    organizationName,
    kpis: EMPTY_KPIS,
    alerts: [],
    projects: [],
    recentProjects: [],
      portfolioAttention: EMPTY_PORTFOLIO_ATTENTION,
      officialChanges: EMPTY_OFFICIAL_CHANGE_COUNTS,
      officialSourceDelayed: false,
      error: error ?? "Could not load overview.",
  };
}

function mapAlert(row: AlertRow): OverviewAlertItem | null {
  if (!isAlertSeverity(row.severity)) {
    return null;
  }

  const project = asSingle(row.projects);
  const operator = asSingle(project?.grid_operators);
  const slug = project?.slug || null;
  const storedHref = row.href?.trim() || "";

  return {
    id: row.id,
    severity: row.severity,
    title: row.title,
    summary: row.summary ?? "",
    detail: row.detail ?? "",
    projectName: project?.name ?? null,
    projectSlug: slug,
    gridOperator: operator?.name ?? null,
    detectedAt: row.created_at,
    ctaLabel: row.cta_label?.trim() || "Review",
    href: storedHref || (slug ? `/projects/${slug}` : "/portfolio"),
  };
}

function sortAlerts(alerts: OverviewAlertItem[]): OverviewAlertItem[] {
  return [...alerts].sort((a, b) => {
    const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (rank !== 0) {
      return rank;
    }
    return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
  });
}

export async function getPortfolioOverview(): Promise<PortfolioOverview> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return emptyOverview("no_organization", null);
  }

  const supabase = await createSupabaseServerClient();
  const [aggregatesResult, projectsResult, casesResult, alertsResult, requirementsResult, projectMetaResult, officialChanges, sourceHealth, unreviewedByProject] =
    await Promise.all([
    getOrganizationProjectAggregates(false),
    listAllProjectsForOrganization("active"),
    fetchAllQueryPages<ConnectionCaseRow>(async (from, to) => {
      const page = await applyArchiveFilter(
        supabase
          .from("connection_cases")
          .select("project_id, stage, status, projects!inner ( organization_id, archived_at )")
          .eq("projects.organization_id", organization.id),
        "active",
        "projects.archived_at",
      ).range(from, to);
      return { data: page.data as ConnectionCaseRow[] | null, error: page.error };
    }),
    fetchAllQueryPages<AlertRow>(async (from, to) => {
      const page = await supabase
        .from("alerts")
        .select(
          `
          id,
          severity,
          title,
          summary,
          detail,
          cta_label,
          href,
          created_at,
          project_id,
          projects ( name, slug, archived_at, grid_operators ( name ) )
        `,
        )
        .eq("organization_id", organization.id)
        .eq("status", "open")
        .range(from, to);
      return { data: page.data as AlertRow[] | null, error: page.error };
    }),
    fetchAllQueryPages<RequirementRow>(async (from, to) => {
      const page = await applyArchiveFilter(
        supabase
          .from("project_requirements")
          .select("project_id, status, required, due_date, projects!inner ( organization_id, archived_at )")
          .eq("projects.organization_id", organization.id),
        "active",
        "projects.archived_at",
      ).range(from, to);
      return { data: page.data as RequirementRow[] | null, error: page.error };
    }),
    fetchAllQueryPages<ProjectMetaRow>(async (from, to) => {
      const page = await applyArchiveFilter(
        supabase
          .from("projects")
          .select("id, slug, name, connection_stage, confidence, target_cod, updated_at, archived_at")
          .eq("organization_id", organization.id)
          .order("updated_at", { ascending: false }),
        "active",
      ).range(from, to);
      return { data: page.data as ProjectMetaRow[] | null, error: page.error };
    }),
    getOfficialChangeImpactCounts(),
    getOfficialSourceHealth(),
    getUnreviewedOfficialChangeCountsByProject(),
  ]);

  if (
    aggregatesResult.error ||
    projectsResult.error ||
    casesResult.error ||
    alertsResult.error ||
    requirementsResult.error ||
    projectMetaResult.error
  ) {
    console.error("getPortfolioOverview query failed", {
      aggregates: aggregatesResult.error,
      projects: projectsResult.error,
      cases: casesResult.error,
      alerts: alertsResult.error,
      requirements: requirementsResult.error,
      projectMeta: projectMetaResult.error,
    });
    return emptyOverview("error", "Could not load overview.", organization.name);
  }

  const projects: OverviewProject[] = projectsResult.projects.map((project) => ({
    id: project.id,
    name: project.name,
    location: project.location,
    technology: project.technology,
    importMW: project.importMW,
    exportMW: project.exportMW,
    stage: project.stage,
    outlook: project.outlook,
    lastUpdated: project.lastUpdated,
  }));

  const cases = casesResult.rows;
  const alertRows = alertsResult.rows.filter((row) => {
    const project = asSingle(row.projects);
    return !project?.archived_at;
  });
  const requirements = requirementsResult.rows;
  const projectMeta = projectMetaResult.rows;
  const alerts = sortAlerts(
    alertRows.map(mapAlert).filter((item): item is OverviewAlertItem => item !== null),
  );

  const casesByProject = new Map<string, ConnectionCaseRow[]>();
  for (const row of cases) {
    const existing = casesByProject.get(row.project_id) ?? [];
    existing.push(row);
    casesByProject.set(row.project_id, existing);
  }

  const requirementsByProject = new Map<string, RequirementRow[]>();
  for (const row of requirements) {
    const existing = requirementsByProject.get(row.project_id) ?? [];
    existing.push(row);
    requirementsByProject.set(row.project_id, existing);
  }

  const alertsByProject = new Map<string, AlertSeverity[]>();
  for (const row of alertRows) {
    if (!row.project_id || !isAlertSeverity(row.severity)) {
      continue;
    }
    const existing = alertsByProject.get(row.project_id) ?? [];
    existing.push(row.severity);
    alertsByProject.set(row.project_id, existing);
  }

  const portfolioAttentionInputs: PortfolioAttentionProjectInput[] = projectMeta.map((row) => {
    const projectRequirements = requirementsByProject.get(row.id) ?? [];
    const mappedRequirements = projectRequirements.map((item) => ({
      required: item.required === true,
      status: checklistStatusLabel(item.status),
      dueDate: item.due_date,
    }));
    const readiness = applicationReadinessFromRequirements(mappedRequirements);
    const projectCase = casesByProject.get(row.id)?.[0] ?? null;

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      stage: pipelineStageLabel(row.connection_stage),
      connectionCaseStatus: projectCase
        ? connectionCaseStatusLabel(projectCase.status)
        : null,
      connectionCaseStatusValue: projectCase?.status ?? null,
      hasConnectionCase: Boolean(projectCase),
      readinessPercent: readiness.percent,
      readinessCompleteCount: readiness.completeCount,
      readinessRequiredCount: readiness.requiredCount,
      confidence: confidenceLabel(row.confidence),
      targetCOD: row.target_cod ?? "",
      requirements: mappedRequirements,
      openAlertSeverities: alertsByProject.get(row.id) ?? [],
      unreviewedOfficialChangeCount: unreviewedByProject.get(row.id) ?? 0,
      lastUpdated: row.updated_at,
    };
  });

  const portfolioAttention = buildPortfolioAttention(portfolioAttentionInputs);

  return {
    kind: "ok",
    organizationName: organization.name,
    kpis: {
      activeSites: aggregatesResult.aggregates.activeCount,
      totalMW: aggregatesResult.aggregates.activeMw,
      connectionEnquiries: aggregatesResult.aggregates.enquiryCount,
      gridStudiesOpen: aggregatesResult.aggregates.openGridStudyCount,
      needsAttention: portfolioAttention.needsAttention.length,
    },
    alerts,
    projects,
    recentProjects: projects.slice(0, 6),
    portfolioAttention,
    officialChanges,
    officialSourceDelayed: sourceHealth.some((item) => isOfficialSourceUpdateDelayed(item.health)),
    error: null,
  };
}
