import { getCurrentOrganization } from "@/lib/data/organization";
import type {
  MapProject,
  MapProjectAlert,
  MapProjectConnectionCase,
  MapProjectsResult,
} from "@/lib/data/map-types";
import { asSingle, parsePoint, toNumber } from "@/lib/data/row-utils";
import { applicationReadinessFromRequirements } from "@/lib/domain/application-readiness";
import {
  checklistStatusLabel,
  confidenceLabel,
  connectionCaseStatusLabel,
  outlookLabel,
  pipelineStageLabel,
  technologyLabel,
} from "@/lib/domain/catalog-labels";
import { calculateDevelopmentProfile } from "@/lib/domain/development-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AlertSeverity, ChecklistStatus } from "@/types";

export type { MapProject, MapProjectsResult } from "@/lib/data/map-types";

type GridOperatorRow = { name: string };

type SiteRow = {
  name: string | null;
  location: string | null;
  geom: unknown;
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
  updated_at: string;
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
  case_id: string | null;
  status: string;
  next_milestone: string | null;
  deadline: string | null;
};

type AlertRow = {
  id: string;
  project_id: string | null;
  severity: string;
  status: string;
  title: string;
};

function isAlertSeverity(value: string): value is AlertSeverity {
  return value === "critical" || value === "warning" || value === "info" || value === "positive";
}

function pickPrimarySite(sites: SiteRow[] | null): SiteRow | null {
  if (!sites?.length) {
    return null;
  }
  return sites.find((site) => site.is_primary) ?? sites[0] ?? null;
}

function groupByProjectId<T extends { project_id: string }>(rows: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const list = grouped.get(row.project_id) ?? [];
    list.push(row);
    grouped.set(row.project_id, list);
  }
  return grouped;
}

function mapConnectionCase(rows: CaseRow[] | undefined): MapProjectConnectionCase | null {
  const row = rows?.[0];
  if (!row) {
    return null;
  }
  return {
    caseId: row.case_id,
    status: connectionCaseStatusLabel(row.status),
    nextMilestone: row.next_milestone,
    deadline: row.deadline,
  };
}

function mapAlerts(rows: AlertRow[] | undefined): MapProjectAlert[] {
  return (rows ?? [])
    .filter((row) => row.status === "open" && isAlertSeverity(row.severity))
    .map((row) => ({
      id: row.id,
      severity: row.severity as AlertSeverity,
      title: row.title,
    }));
}

function mapProject(
  row: ProjectRow,
  requirements: RequirementRow[] | undefined,
  cases: CaseRow[] | undefined,
  alerts: AlertRow[] | undefined,
): MapProject {
  const operator = asSingle(row.grid_operators);
  const site = pickPrimarySite(row.project_sites);
  const point = parsePoint(site?.geom);
  const readiness = applicationReadinessFromRequirements(
    (requirements ?? []).map((item) => ({
      status: checklistStatusLabel(item.status) as ChecklistStatus,
      required: item.required === true,
    })),
  );
  const connectionCase = mapConnectionCase(cases);
  const openAlerts = mapAlerts(alerts);
  const outlook = outlookLabel(row.connection_outlook);
  const confidence = confidenceLabel(row.confidence);
  const stage = pipelineStageLabel(row.connection_stage);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    location: row.location || site?.location || site?.name || "",
    technology: technologyLabel(row.technology),
    importMW: toNumber(row.import_mw),
    exportMW: toNumber(row.export_mw),
    gridOperator: operator?.name ?? "",
    stage,
    outlook,
    confidence,
    targetCOD: row.target_cod ?? "",
    lastUpdated: row.updated_at,
    latitude: point?.latitude ?? 0,
    longitude: point?.longitude ?? 0,
    hasCoordinates: point !== null,
    readinessPercent: readiness.percent,
    connectionCase,
    openAlerts,
    developmentProfile: calculateDevelopmentProfile({
      outlook,
      confidence,
      stage,
      readinessPercent: readiness.percent,
      openCriticalAlerts: openAlerts.filter((alert) => alert.severity === "critical").length,
      openWarningAlerts: openAlerts.filter((alert) => alert.severity === "warning").length,
      connectionCaseStatus: connectionCase?.status ?? null,
    }),
  };
}

export async function getMapProjectsForCurrentOrganization(): Promise<MapProjectsResult> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { kind: "no_organization" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
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
      updated_at,
      grid_operators ( name ),
      project_sites ( name, location, geom, is_primary )
    `,
    )
    .eq("organization_id", organization.id)
    .order("name", { ascending: true });

  if (error) {
    console.error("getMapProjectsForCurrentOrganization failed", error.message);
    return { kind: "error", message: "Could not load map projects." };
  }

  const projectRows = (data ?? []) as ProjectRow[];
  const ids = projectRows.map((row) => row.id);

  if (ids.length === 0) {
    return { kind: "ok", projects: [] };
  }

  const [requirementsResult, casesResult, alertsResult] = await Promise.all([
    supabase
      .from("project_requirements")
      .select("project_id, status, required")
      .in("project_id", ids),
    supabase
      .from("connection_cases")
      .select("project_id, case_id, status, next_milestone, deadline")
      .in("project_id", ids),
    supabase
      .from("alerts")
      .select("id, project_id, severity, status, title")
      .eq("status", "open")
      .in("project_id", ids),
  ]);

  if (requirementsResult.error || casesResult.error || alertsResult.error) {
    console.error("getMapProjectsForCurrentOrganization related queries failed", {
      requirements: requirementsResult.error?.message,
      cases: casesResult.error?.message,
      alerts: alertsResult.error?.message,
    });
    return { kind: "error", message: "Could not load map projects." };
  }

  const requirementsByProject = groupByProjectId(
    (requirementsResult.data ?? []) as RequirementRow[],
  );
  const casesByProject = groupByProjectId((casesResult.data ?? []) as CaseRow[]);
  const alertsByProject = groupByProjectId(
    ((alertsResult.data ?? []) as AlertRow[]).filter(
      (row): row is AlertRow & { project_id: string } => Boolean(row.project_id),
    ),
  );

  return {
    kind: "ok",
    projects: projectRows.map((row) =>
      mapProject(
        row,
        requirementsByProject.get(row.id),
        casesByProject.get(row.id),
        alertsByProject.get(row.id),
      ),
    ),
  };
}
