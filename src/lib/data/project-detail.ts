import { cache } from "react";
import { getOfficialGridAreaContextForProject } from "@/lib/data/grid-intelligence";
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
import type { OfficialGridAreaContext } from "@/lib/domain/grid-intelligence";
import {
  checklistStatusLabel,
  confidenceLabel,
  connectionCaseStatusLabel,
  dataSourceLabel,
  documentCategoryLabel,
  documentStatusLabel,
  outlookLabel,
  pipelineStageLabel,
  requirementCategoryLabel,
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

type ProfileRow = { id: string; full_name: string | null };

type CaseRow = {
  case_id: string | null;
  status: string;
  submitted_at: string | null;
  next_milestone: string | null;
  deadline: string | null;
  owner_id: string | null;
  notes: string | null;
};

type RequirementRow = {
  id: string;
  label: string;
  status: string;
  required: boolean;
  category: string;
  due_date: string | null;
  created_at: string;
};

type DocumentRow = {
  id: string;
  name: string;
  category: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
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
};

function isAlertSeverity(value: string): value is AlertSeverity {
  return value === "critical" || value === "warning" || value === "info" || value === "positive";
}

function writableRole(role: string): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

function profileName(profiles: ProfileRow[], id: string | null): string | null {
  if (!id) {
    return null;
  }
  const name = profiles.find((row) => row.id === id)?.full_name?.trim();
  return name || null;
}

function mapRequirements(rows: RequirementRow[]): ProjectRequirementItem[] {
  return [...rows]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((row) => ({
      id: row.id,
      label: row.label,
      status: checklistStatusLabel(row.status),
      required: row.required === true,
      category: requirementCategoryLabel(row.category),
      dueDate: row.due_date,
    }));
}

function mapDocuments(rows: DocumentRow[], profiles: ProfileRow[]): ProjectDocumentItem[] {
  return [...rows]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .map((row) => ({
      id: row.id,
      name: row.name,
      category: documentCategoryLabel(row.category),
      status: documentStatusLabel(row.status),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      owner: profileName(profiles, row.owner_id),
    }));
}

function mapEvents(rows: EventRow[]): ProjectEventItem[] {
  return [...rows]
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

function mapAlerts(rows: AlertRow[]): ProjectAlertItem[] {
  return rows
    .filter((row) => row.status === "open" && isAlertSeverity(row.severity))
    .map((row) => ({
      id: row.id,
      severity: row.severity as AlertSeverity,
      title: row.title,
      summary: row.summary ?? "",
    }));
}

function mapCase(rows: CaseRow[], profiles: ProfileRow[]): ProjectConnectionCase | null {
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    caseId: row.case_id,
    status: connectionCaseStatusLabel(row.status),
    submittedAt: row.submitted_at,
    nextMilestone: row.next_milestone,
    deadline: row.deadline,
    ownerName: profileName(profiles, row.owner_id),
    notes: row.notes?.trim() || null,
  };
}

function mapProject(
  row: ProjectRow,
  related: {
    cases: CaseRow[];
    requirements: RequirementRow[];
    documents: DocumentRow[];
    events: EventRow[];
    alerts: AlertRow[];
    profiles: ProfileRow[];
  },
  canUpdateRequirements: boolean,
  officialGridAreaContext: OfficialGridAreaContext | null,
): ProjectDetailViewModel {
  const operator = asSingle(row.grid_operators);
  const site =
    (row.project_sites ?? []).find((item) => item.is_primary) ?? row.project_sites?.[0] ?? null;
  const point = parsePoint(site?.geom);
  const requirements = mapRequirements(related.requirements);
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
    readinessCompleteCount: readiness.completeCount,
    readinessRequiredCount: readiness.requiredCount,
    requirements,
    connectionCase: mapCase(related.cases, related.profiles),
    documents: mapDocuments(related.documents, related.profiles),
    events: mapEvents(related.events),
    alerts: mapAlerts(related.alerts),
    canUpdateRequirements,
    officialGridAreaContext,
  };
}

async function loadProjectDetailBySlug(slug: string): Promise<ProjectDetailResult> {
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
      project_sites ( name, location, geom, is_primary )
    `,
    )
    .eq("organization_id", organization.id)
    .eq("slug", trimmed)
    .maybeSingle();

  if (error) {
    console.error("getProjectDetailBySlug project query failed", error.message);
    return { kind: "error", message: "Could not load project." };
  }

  if (!data) {
    return { kind: "not_found" };
  }

  const project = data as ProjectRow;
  const projectId = project.id;

  const [casesResult, requirementsResult, documentsResult, eventsResult, alertsResult, officialContext] =
    await Promise.all([
      supabase
        .from("connection_cases")
        .select("case_id, status, submitted_at, next_milestone, deadline, owner_id, notes")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("project_requirements")
        .select("id, label, status, required, category, due_date, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true }),
      supabase
        .from("documents")
        .select("id, name, category, status, created_at, updated_at, owner_id")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("project_events")
        .select("id, title, detail, source, occurred_at")
        .eq("project_id", projectId)
        .order("occurred_at", { ascending: false }),
      supabase
        .from("alerts")
        .select("id, severity, title, summary, status")
        .eq("project_id", projectId)
        .eq("status", "open"),
      getOfficialGridAreaContextForProject(projectId),
    ]);

  const relatedError =
    casesResult.error ||
    requirementsResult.error ||
    documentsResult.error ||
    eventsResult.error ||
    alertsResult.error;

  if (relatedError) {
    console.error("getProjectDetailBySlug related query failed", relatedError.message);
    return { kind: "error", message: "Could not load project." };
  }

  const cases = (casesResult.data ?? []) as CaseRow[];
  const documents = (documentsResult.data ?? []) as DocumentRow[];
  const ownerIds = [
    ...new Set(
      [...cases.map((row) => row.owner_id), ...documents.map((row) => row.owner_id)].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ];

  let profiles: ProfileRow[] = [];
  if (ownerIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ownerIds);
    if (profileError) {
      console.error("getProjectDetailBySlug profile query failed", profileError.message);
    } else {
      profiles = (profileRows ?? []) as ProfileRow[];
    }
  }

  return {
    kind: "ok",
    project: mapProject(
      project,
      {
        cases,
        requirements: (requirementsResult.data ?? []) as RequirementRow[],
        documents,
        events: (eventsResult.data ?? []) as EventRow[],
        alerts: (alertsResult.data ?? []) as AlertRow[],
        profiles,
      },
      writableRole(organization.role),
      officialContext,
    ),
  };
}

export const getProjectDetailBySlug = cache(loadProjectDetailBySlug);
