import { getCurrentOrganization } from "@/lib/data/organization";
import {
  type OverviewAlertItem,
  type OverviewImpact,
  type OverviewKpis,
  type OverviewProject,
  type PortfolioOverview,
} from "@/lib/data/overview-types";
import { listProjects } from "@/lib/data/projects";
import { totalPortfolioMW } from "@/lib/domain/portfolio-capacity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AlertSeverity } from "@/types";

export type {
  OverviewAlertItem,
  OverviewImpact,
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

type GridOperatorEmbed = { name: string };

type AlertProjectEmbed = {
  name: string;
  slug: string;
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

const EMPTY_KPIS: OverviewKpis = {
  activeSites: 0,
  totalMW: 0,
  connectionEnquiries: 0,
  gridStudiesOpen: 0,
  needsAttention: 0,
};

const EMPTY_IMPACT: OverviewImpact = {
  projectsMonitored: 0,
  sitesDeprioritisedLabel: "—",
  changesDetectedLabel: "—",
  hoursAvoidedLabel: "—",
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
      impact: EMPTY_IMPACT,
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
    impact: EMPTY_IMPACT,
    error: error ?? "Could not load overview.",
  };
}

function needsAttentionCount(
  cases: ConnectionCaseRow[],
  alerts: AlertRow[],
): number {
  const projectIds = new Set<string>();

  for (const row of alerts) {
    if (
      row.project_id &&
      (row.severity === "critical" || row.severity === "warning")
    ) {
      projectIds.add(row.project_id);
    }
  }

  for (const row of cases) {
    if (row.status === "at_risk" || row.status === "overdue") {
      projectIds.add(row.project_id);
    }
  }

  return projectIds.size;
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
  const [projectsResult, casesResult, alertsResult] = await Promise.all([
    listProjects(),
    supabase.from("connection_cases").select("project_id, stage, status"),
    supabase
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
        projects ( name, slug, grid_operators ( name ) )
      `,
      )
      .eq("status", "open"),
  ]);

  if (
    projectsResult.error ||
    projectsResult.blockedByRls ||
    casesResult.error ||
    alertsResult.error
  ) {
    console.error("getPortfolioOverview query failed", {
      projects: projectsResult.error,
      cases: casesResult.error?.message,
      alerts: alertsResult.error?.message,
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

  const cases = (casesResult.data ?? []) as ConnectionCaseRow[];
  const alertRows = (alertsResult.data ?? []) as AlertRow[];
  const alerts = sortAlerts(
    alertRows.map(mapAlert).filter((item): item is OverviewAlertItem => item !== null),
  );

  const connectionEnquiries = cases.filter((row) => row.stage === "enquiry").length;
  const gridStudiesOpen = cases.filter(
    (row) =>
      row.stage === "grid_study" && row.status !== "complete" && row.status !== "cancelled",
  ).length;

  return {
    kind: "ok",
    organizationName: organization.name,
    kpis: {
      activeSites: projects.length,
      totalMW: totalPortfolioMW(projects),
      connectionEnquiries,
      gridStudiesOpen,
      needsAttention: needsAttentionCount(cases, alertRows),
    },
    alerts,
    projects,
    recentProjects: projects.slice(0, 6),
    impact: {
      projectsMonitored: projects.length,
      sitesDeprioritisedLabel: "—",
      changesDetectedLabel: "—",
      hoursAvoidedLabel: "—",
    },
    error: null,
  };
}
