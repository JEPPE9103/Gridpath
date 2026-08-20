import { getCurrentOrganization } from "@/lib/data/organization";
import { OVERVIEW_PIPELINE_STAGES } from "@/lib/data/overview-types";
import type {
  PortfolioReportResult,
  PortfolioReportViewModel,
  ReportAttentionProject,
  ReportExportRow,
  ReportNamedCount,
  ReportOperatorMW,
  ReportTechnologyMix,
} from "@/lib/data/report-types";
import { asSingle, toNumber } from "@/lib/data/row-utils";
import { isActiveConnectionCase } from "@/lib/data/connections-types";
import { applicationReadinessFromRequirements } from "@/lib/domain/application-readiness";
import {
  countProjectsNeedingAttention,
  projectIdsNeedingAttention,
} from "@/lib/domain/attention";
import {
  checklistStatusLabel,
  confidenceLabel,
  connectionCaseStatusLabel,
  documentStatusLabel,
  outlookLabel,
  pipelineStageLabel,
  technologyLabel,
} from "@/lib/domain/catalog-labels";
import { deadlineAttention } from "@/lib/domain/connection-deadlines";
import { portfolioCapacityMW, totalPortfolioMW } from "@/lib/domain/portfolio-capacity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ChecklistStatus, DocumentStatus, Outlook, Technology } from "@/types";
import { TECHNOLOGIES } from "@/types";

export type { PortfolioReportResult } from "@/lib/data/report-types";

const REPORT_OUTLOOKS: Outlook[] = ["Favourable", "Possible", "At Risk", "Weak", "Unknown"];

type GridOperatorRow = { name: string };

type SiteRow = {
  location: string | null;
  is_primary: boolean;
};

type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  technology: string | null;
  import_mw: number | string | null;
  export_mw: number | string | null;
  connection_stage: string;
  connection_outlook: string;
  confidence: string;
  target_cod: string | null;
  grid_operators: GridOperatorRow | GridOperatorRow[] | null;
  project_sites: SiteRow[] | null;
};

type RequirementRow = {
  project_id: string;
  status: string;
  required: boolean;
};

type CaseRow = {
  project_id: string;
  status: string;
  next_milestone: string | null;
  deadline: string | null;
};

type AlertRow = {
  id: string;
  project_id: string | null;
  severity: string;
  status: string;
};

type DocumentRow = {
  status: string;
};

type MappedProject = {
  id: string;
  slug: string;
  name: string;
  location: string;
  technology: Technology;
  importMW: number;
  exportMW: number;
  gridOperator: string;
  stage: ReturnType<typeof pipelineStageLabel>;
  outlook: Outlook;
  confidence: ReturnType<typeof confidenceLabel>;
  targetCOD: string;
  readinessPercent: number | null;
};

function groupByProjectId<T extends { project_id: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.project_id) ?? [];
    list.push(row);
    grouped.set(row.project_id, list);
  }
  return grouped;
}

function readinessLabel(percent: number | null): string {
  return percent == null ? "Not available" : `${percent}%`;
}

function averageReadiness(percents: Array<number | null>): number | null {
  const scored = percents.filter((value): value is number => value != null);
  if (scored.length === 0) {
    return null;
  }
  return Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length);
}

function stageCounts(projects: MappedProject[]): ReportNamedCount[] {
  const counts = Object.fromEntries(OVERVIEW_PIPELINE_STAGES.map((stage) => [stage, 0])) as Record<
    string,
    number
  >;
  for (const project of projects) {
    counts[project.stage] = (counts[project.stage] ?? 0) + 1;
  }
  return OVERVIEW_PIPELINE_STAGES.map((stage) => ({
    label: stage,
    count: counts[stage] ?? 0,
  }));
}

function outlookCounts(projects: MappedProject[]): ReportNamedCount[] {
  const counts = new Map<string, number>(REPORT_OUTLOOKS.map((outlook) => [outlook, 0]));
  for (const project of projects) {
    counts.set(project.outlook, (counts.get(project.outlook) ?? 0) + 1);
  }
  const ordered: ReportNamedCount[] = REPORT_OUTLOOKS.map((outlook) => ({
    label: outlook,
    count: counts.get(outlook) ?? 0,
  }));
  for (const [label, count] of counts) {
    if (!REPORT_OUTLOOKS.includes(label as Outlook) && count > 0) {
      ordered.push({ label, count });
    }
  }
  return ordered;
}

function operatorMW(projects: MappedProject[]): ReportOperatorMW[] {
  const map = new Map<string, { mw: number; count: number }>();
  for (const project of projects) {
    const operator = project.gridOperator || "Unassigned";
    const current = map.get(operator) ?? { mw: 0, count: 0 };
    current.mw += portfolioCapacityMW(project);
    current.count += 1;
    map.set(operator, current);
  }
  return [...map.entries()]
    .map(([operator, value]) => ({ operator, ...value }))
    .sort((a, b) => b.mw - a.mw || a.operator.localeCompare(b.operator, "sv"));
}

function technologyMix(projects: MappedProject[]): ReportTechnologyMix[] {
  const map = new Map<string, { count: number; mw: number }>();
  for (const technology of TECHNOLOGIES) {
    map.set(technology, { count: 0, mw: 0 });
  }
  map.set("Other", { count: 0, mw: 0 });

  for (const project of projects) {
    const key = TECHNOLOGIES.includes(project.technology) ? project.technology : "Other";
    const current = map.get(key) ?? { count: 0, mw: 0 };
    current.count += 1;
    current.mw += portfolioCapacityMW(project);
    map.set(key, current);
  }

  return [...TECHNOLOGIES, "Other"]
    .map((technology) => ({
      technology,
      count: map.get(technology)?.count ?? 0,
      mw: map.get(technology)?.mw ?? 0,
    }))
    .filter((row) => row.count > 0 || row.technology !== "Other");
}

export async function getPortfolioReportForCurrentOrganization(): Promise<PortfolioReportResult> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { kind: "no_organization" };
  }

  const supabase = await createSupabaseServerClient();
  const [projectsResult, casesResult, requirementsResult, alertsResult, documentsResult] =
    await Promise.all([
      supabase
        .from("projects")
        .select(
          `
          id,
          slug,
          name,
          location,
          technology,
          import_mw,
          export_mw,
          connection_stage,
          connection_outlook,
          confidence,
          target_cod,
          grid_operators ( name ),
          project_sites ( location, is_primary )
        `,
        )
        .eq("organization_id", organization.id)
        .order("name", { ascending: true }),
      supabase
        .from("connection_cases")
        .select(
          `
          project_id,
          status,
          next_milestone,
          deadline,
          projects!inner ( organization_id )
        `,
        )
        .eq("projects.organization_id", organization.id),
      supabase
        .from("project_requirements")
        .select("project_id, status, required, projects!inner ( organization_id )")
        .eq("projects.organization_id", organization.id),
      supabase
        .from("alerts")
        .select("id, project_id, severity, status")
        .eq("organization_id", organization.id)
        .eq("status", "open"),
      supabase
        .from("documents")
        .select("status, projects!inner ( organization_id )")
        .eq("projects.organization_id", organization.id),
    ]);

  if (
    projectsResult.error ||
    casesResult.error ||
    requirementsResult.error ||
    alertsResult.error ||
    documentsResult.error
  ) {
    console.error("getPortfolioReportForCurrentOrganization failed", {
      projects: projectsResult.error?.message,
      cases: casesResult.error?.message,
      requirements: requirementsResult.error?.message,
      alerts: alertsResult.error?.message,
      documents: documentsResult.error?.message,
    });
    return { kind: "error", message: "Could not load portfolio report." };
  }

  const projectRows = (projectsResult.data ?? []) as ProjectRow[];
  const caseRows = (casesResult.data ?? []) as CaseRow[];
  const requirementRows = (requirementsResult.data ?? []) as RequirementRow[];
  const alertRows = (alertsResult.data ?? []) as AlertRow[];
  const documentRows = (documentsResult.data ?? []) as DocumentRow[];

  const requirementsByProject = groupByProjectId(requirementRows);
  const casesByProject = groupByProjectId(caseRows);
  const alertsByProject = groupByProjectId(
    alertRows.filter((row): row is AlertRow & { project_id: string } => Boolean(row.project_id)),
  );

  const projects: MappedProject[] = projectRows.map((row) => {
    const operator = asSingle(row.grid_operators);
    const site =
      (row.project_sites ?? []).find((item) => item.is_primary) ?? row.project_sites?.[0] ?? null;
    const readiness = applicationReadinessFromRequirements(
      (requirementsByProject.get(row.id) ?? []).map((item) => ({
        status: checklistStatusLabel(item.status) as ChecklistStatus,
        required: item.required === true,
      })),
    );
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      location: row.location || site?.location || "",
      technology: technologyLabel(row.technology),
      importMW: toNumber(row.import_mw),
      exportMW: toNumber(row.export_mw),
      gridOperator: operator?.name ?? "",
      stage: pipelineStageLabel(row.connection_stage),
      outlook: outlookLabel(row.connection_outlook),
      confidence: confidenceLabel(row.confidence),
      targetCOD: row.target_cod ?? "",
      readinessPercent: readiness.percent,
    };
  });

  const activeCases = caseRows.filter((row) =>
    isActiveConnectionCase(connectionCaseStatusLabel(row.status)),
  );
  const scoredPercents = projects.map((project) => project.readinessPercent);
  const averagePercent = averageReadiness(scoredPercents);
  const attentionIds = projectIdsNeedingAttention(caseRows, alertRows);

  const attentionProjects: ReportAttentionProject[] = projects
    .filter((project) => attentionIds.has(project.id))
    .map((project) => {
      const connection = casesByProject.get(project.id)?.[0] ?? null;
      const alerts = alertsByProject.get(project.id) ?? [];
      return {
        slug: project.slug,
        name: project.name,
        stage: project.stage,
        outlook: project.outlook,
        readinessPercent: project.readinessPercent,
        openCriticalAlerts: alerts.filter((alert) => alert.severity === "critical").length,
        openWarningAlerts: alerts.filter((alert) => alert.severity === "warning").length,
        connectionStatus: connection ? connectionCaseStatusLabel(connection.status) : null,
        nextMilestone: connection?.next_milestone ?? null,
        deadline: connection?.deadline ?? null,
        deadlineAttention: deadlineAttention(connection?.deadline),
      };
    })
    .sort((a, b) => {
      const alertDelta =
        b.openCriticalAlerts + b.openWarningAlerts - (a.openCriticalAlerts + a.openWarningAlerts);
      if (alertDelta !== 0) {
        return alertDelta;
      }
      return a.name.localeCompare(b.name, "sv");
    });

  const exportRows: ReportExportRow[] = projects.map((project) => {
    const connection = casesByProject.get(project.id)?.[0] ?? null;
    return {
      slug: project.slug,
      name: project.name,
      location: project.location,
      technology: project.technology,
      importMW: project.importMW,
      exportMW: project.exportMW,
      portfolioMW: portfolioCapacityMW(project),
      gridOperator: project.gridOperator,
      stage: project.stage,
      outlook: project.outlook,
      confidence: project.confidence,
      targetCOD: project.targetCOD,
      readiness: readinessLabel(project.readinessPercent),
      connectionStatus: connection
        ? connectionCaseStatusLabel(connection.status)
        : "No connection case",
      nextMilestone: connection?.next_milestone?.trim() || "",
      deadline: connection?.deadline ?? "",
    };
  });

  const documentHealth = {
    complete: 0,
    inProgress: 0,
    draft: 0,
    missing: 0,
    total: documentRows.length,
  };
  for (const row of documentRows) {
    const status = documentStatusLabel(row.status) as DocumentStatus;
    if (status === "Complete") documentHealth.complete += 1;
    else if (status === "In Progress") documentHealth.inProgress += 1;
    else if (status === "Draft") documentHealth.draft += 1;
    else documentHealth.missing += 1;
  }

  const report: PortfolioReportViewModel = {
    organizationName: organization.name,
    summary: {
      projectCount: projects.length,
      portfolioMW: totalPortfolioMW(projects),
      activeConnectionCases: activeCases.length,
      needsAttention: countProjectsNeedingAttention(caseRows, alertRows),
      openAlerts: alertRows.length,
      averageReadinessPercent: averagePercent,
    },
    stageCounts: stageCounts(projects),
    outlookCounts: outlookCounts(projects),
    operatorMW: operatorMW(projects),
    technologyMix: technologyMix(projects),
    connectionHealth: {
      onTrack: activeCases.filter((row) => connectionCaseStatusLabel(row.status) === "On Track")
        .length,
      waiting: activeCases.filter((row) => connectionCaseStatusLabel(row.status) === "Waiting")
        .length,
      atRisk: activeCases.filter((row) => connectionCaseStatusLabel(row.status) === "At Risk")
        .length,
      overdue: activeCases.filter((row) => connectionCaseStatusLabel(row.status) === "Overdue")
        .length,
      upcomingDeadlines: activeCases.filter(
        (row) => deadlineAttention(row.deadline) === "approaching",
      ).length,
    },
    readiness: {
      averagePercent,
      atLeast80: scoredPercents.filter((value) => value != null && value >= 80).length,
      from50to79: scoredPercents.filter((value) => value != null && value >= 50 && value < 80)
        .length,
      below50: scoredPercents.filter((value) => value != null && value < 50).length,
      notAvailable: scoredPercents.filter((value) => value == null).length,
      scoredCount: scoredPercents.filter((value) => value != null).length,
    },
    attentionProjects,
    documentHealth,
    operational: {
      projectsMonitored: projects.length,
      openIssues: alertRows.filter(
        (alert) => alert.severity === "critical" || alert.severity === "warning",
      ).length,
      connectionCasesManaged: activeCases.length,
      requirementsTracked: requirementRows.length,
      documentsTracked: documentRows.length,
    },
    exportRows,
  };

  return { kind: "ok", report };
}
