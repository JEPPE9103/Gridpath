import { getCurrentOrganization } from "@/lib/data/organization";
import type {
  ProjectAlertItem,
  ProjectConnectionCase,
  ProjectDetailResult,
  ProjectDetailViewModel,
  ProjectDocumentItem,
  ProjectEventItem,
  ProjectRequirementItem,
} from "@/lib/data/project-detail-types";
import { asSingle, parsePoint, toNumber } from "@/lib/data/row-utils";
import { applicationReadinessFromRequirements } from "@/lib/domain/application-readiness";
import {
  checklistStatusLabel,
  confidenceLabel,
  connectionCaseStatusLabel,
  dataSourceLabel,
  documentCategoryLabel,
  documentStatusLabel,
  outlookLabel,
  pipelineStageLabel,
  technologyLabel,
} from "@/lib/domain/catalog-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AlertSeverity } from "@/types";

type GridOperatorRow = { name: string };
type SiteRow = {
  name: string | null;
  location: string | null;
  geom: unknown;
  is_primary: boolean;
};

type CaseRow = {
  case_id: string | null;
  status: string;
  submitted_at: string | null;
  next_milestone: string | null;
  deadline: string | null;
};

type RequirementRow = {
  id: string;
  label: string;
  status: string;
  created_at: string;
};

type DocumentRow = {
  id: string;
  name: string;
  category: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  title: string;
  detail: string | null;
  source: string | null;
  occurred_at: string;
};

type AlertRow = {
  id: string;
  severity: string;
  title: string;
  summary: string | null;
  status: string;
};

type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  location: string | null;
  region: string | null;
  technology: string | null;
  import_mw: number | string | null;
  export_mw: number | string | null;
  voltage_level: string | null;
  connection_stage: string;
  connection_outlook: string;
  confidence: string;
  target_cod: string | null;
  updated_at: string;
  grid_operators: GridOperatorRow | GridOperatorRow[] | null;
  project_sites: SiteRow[] | null;
  connection_cases: CaseRow[] | null;
  project_requirements: RequirementRow[] | null;
  documents: DocumentRow[] | null;
  project_events: EventRow[] | null;
  alerts: AlertRow[] | null;
};

function isAlertSeverity(value: string): value is AlertSeverity {
  return value === "critical" || value === "warning" || value === "info" || value === "positive";
}

function writableRole(role: string): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

function mapRequirements(rows: RequirementRow[] | null): ProjectRequirementItem[] {
  return [...(rows ?? [])]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((row) => ({
      id: row.id,
      label: row.label,
      status: checklistStatusLabel(row.status),
      required: true,
      category: null,
      dueDate: null,
    }));
}

function mapDocuments(rows: DocumentRow[] | null): ProjectDocumentItem[] {
  return [...(rows ?? [])]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .map((row) => ({
      id: row.id,
      name: row.name,
      category: documentCategoryLabel(row.category),
      status: documentStatusLabel(row.status),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      owner: null,
    }));
}

function mapEvents(rows: EventRow[] | null): ProjectEventItem[] {
  return [...(rows ?? [])]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .map((row) => ({
      id: row.id,
      title: row.title,
      detail: row.detail ?? "",
      occurredAt: row.occurred_at,
      eventType: row.source,
      source: dataSourceLabel(row.source),
    }));
}

function mapAlerts(rows: AlertRow[] | null): ProjectAlertItem[] {
  return (rows ?? [])
    .filter((row) => row.status === "open" && isAlertSeverity(row.severity))
    .map((row) => ({
      id: row.id,
      severity: row.severity as AlertSeverity,
      title: row.title,
      summary: row.summary ?? "",
    }));
}

function mapCase(rows: CaseRow[] | null): ProjectConnectionCase | null {
  const row = rows?.[0];
  if (!row) {
    return null;
  }
  return {
    caseId: row.case_id,
    status: connectionCaseStatusLabel(row.status),
    submittedAt: row.submitted_at,
    nextMilestone: row.next_milestone,
    deadline: row.deadline,
    ownerName: null,
    notes: null,
  };
}

function mapProject(row: ProjectRow, canUpdateRequirements: boolean): ProjectDetailViewModel {
  const operator = asSingle(row.grid_operators);
  const site = (row.project_sites ?? []).find((item) => item.is_primary) ?? row.project_sites?.[0] ?? null;
  const point = parsePoint(site?.geom);
  const requirements = mapRequirements(row.project_requirements);
  const readiness = applicationReadinessFromRequirements(requirements);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? "",
    technology: technologyLabel(row.technology),
    location: row.location || site?.location || site?.name || "",
    region: row.region ?? "",
    latitude: point?.latitude ?? 0,
    longitude: point?.longitude ?? 0,
    hasCoordinates: point !== null,
    importMW: toNumber(row.import_mw),
    exportMW: toNumber(row.export_mw),
    gridOperator: operator?.name ?? "",
    voltageLevel: row.voltage_level ?? "",
    stage: pipelineStageLabel(row.connection_stage),
    outlook: outlookLabel(row.connection_outlook),
    confidence: confidenceLabel(row.confidence),
    targetCOD: row.target_cod ?? "",
    lastUpdated: row.updated_at,
    readinessPercent: readiness.percent,
    requirements,
    connectionCase: mapCase(row.connection_cases),
    documents: mapDocuments(row.documents),
    events: mapEvents(row.project_events),
    alerts: mapAlerts(row.alerts),
    canUpdateRequirements,
  };
}

export async function getProjectDetailBySlug(slug: string): Promise<ProjectDetailResult> {
  const trimmed = slug.trim();
  if (!trimmed) {
    return { kind: "not_found" };
  }

  const organization = await getCurrentOrganization();
  if (!organization) {
    return { kind: "not_found" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      slug,
      name,
      description,
      location,
      region,
      technology,
      import_mw,
      export_mw,
      voltage_level,
      connection_stage,
      connection_outlook,
      confidence,
      target_cod,
      updated_at,
      grid_operators ( name ),
      project_sites ( name, location, geom, is_primary ),
      connection_cases ( case_id, status, submitted_at, next_milestone, deadline ),
      project_requirements ( id, label, status, created_at ),
      documents ( id, name, category, status, created_at, updated_at ),
      project_events ( id, title, detail, source, occurred_at ),
      alerts ( id, severity, title, summary, status )
    `,
    )
    .eq("organization_id", organization.id)
    .eq("slug", trimmed)
    .maybeSingle();

  if (error) {
    console.error("getProjectDetailBySlug failed", error.message);
    return { kind: "error", message: "Could not load project." };
  }

  if (!data) {
    return { kind: "not_found" };
  }

  return {
    kind: "ok",
    project: mapProject(data as ProjectRow, writableRole(organization.role)),
  };
}
