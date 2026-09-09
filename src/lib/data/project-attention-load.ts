import { getCurrentOrganization } from "@/lib/data/organization";
import { applyArchiveFilter } from "@/lib/data/archive-filter";
import { fetchAllQueryPages } from "@/lib/data/paged-select";
import { getUnreviewedOfficialChangeCountsByProject } from "@/lib/data/grid-changes";
import { getOrganizationOfficialSpatialMatches } from "@/lib/data/official-map";
import { applicationReadinessFromRequirements } from "@/lib/domain/application-readiness";
import {
  checklistStatusLabel,
  confidenceLabel,
  connectionCaseStatusLabel,
  pipelineStageLabel,
} from "@/lib/domain/catalog-labels";
import { isUnmatchedReviewProject } from "@/lib/domain/official-map";
import type { PortfolioAttentionProjectInput } from "@/lib/intelligence/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AlertSeverity, ChecklistStatus } from "@/types";

type ConnectionCaseRow = {
  project_id: string;
  stage: string;
  status: string;
  next_milestone: string | null;
  deadline: string | null;
  created_at: string | null;
  owner_id: string | null;
};

type RequirementRow = {
  id: string;
  project_id: string;
  label: string;
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

type EventRow = {
  project_id: string;
  title: string;
  occurred_at: string;
};

type AlertRow = {
  project_id: string | null;
  severity: string;
};

function isAlertSeverity(value: string): value is AlertSeverity {
  return value === "critical" || value === "warning" || value === "info" || value === "positive";
}

function groupByProject<T extends { project_id: string | null }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.project_id) {
      continue;
    }
    const existing = map.get(row.project_id) ?? [];
    existing.push(row);
    map.set(row.project_id, existing);
  }
  return map;
}

export async function loadOrganizationAttentionInputs(): Promise<{
  inputs: PortfolioAttentionProjectInput[];
  error: string | null;
}> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { inputs: [], error: null };
  }

  const supabase = await createSupabaseServerClient();
  const [
    casesResult,
    requirementsResult,
    projectMetaResult,
    eventsResult,
    alertsResult,
    unreviewedByProject,
    spatialMatches,
  ] = await Promise.all([
    fetchAllQueryPages<ConnectionCaseRow>(async (from, to) => {
      const page = await applyArchiveFilter(
        supabase
          .from("connection_cases")
          .select(
            "project_id, stage, status, next_milestone, deadline, created_at, owner_id, projects!inner ( organization_id, archived_at )",
          )
          .eq("projects.organization_id", organization.id),
        "active",
        "projects.archived_at",
      ).range(from, to);
      return { data: page.data as ConnectionCaseRow[] | null, error: page.error };
    }),
    fetchAllQueryPages<RequirementRow>(async (from, to) => {
      const page = await applyArchiveFilter(
        supabase
          .from("project_requirements")
          .select(
            "id, project_id, label, status, required, due_date, projects!inner ( organization_id, archived_at )",
          )
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
    fetchAllQueryPages<EventRow>(async (from, to) => {
      const page = await applyArchiveFilter(
        supabase
          .from("project_events")
          .select("project_id, title, occurred_at, projects!inner ( organization_id, archived_at )")
          .eq("projects.organization_id", organization.id)
          .order("occurred_at", { ascending: false }),
        "active",
        "projects.archived_at",
      ).range(from, to);
      return { data: page.data as EventRow[] | null, error: page.error };
    }),
    fetchAllQueryPages<AlertRow>(async (from, to) => {
      const page = await supabase
        .from("alerts")
        .select("project_id, severity, projects ( archived_at )")
        .eq("organization_id", organization.id)
        .eq("status", "open")
        .range(from, to);
      return { data: page.data as AlertRow[] | null, error: page.error };
    }),
    getUnreviewedOfficialChangeCountsByProject(),
    getOrganizationOfficialSpatialMatches(),
  ]);

  if (
    casesResult.error ||
    requirementsResult.error ||
    projectMetaResult.error ||
    eventsResult.error ||
    alertsResult.error
  ) {
    console.error("loadOrganizationAttentionInputs failed", {
      cases: casesResult.error,
      requirements: requirementsResult.error,
      projectMeta: projectMetaResult.error,
      events: eventsResult.error,
      alerts: alertsResult.error,
    });
    return { inputs: [], error: "Could not load portfolio attention." };
  }

  const casesByProject = groupByProject(casesResult.rows);
  const requirementsByProject = groupByProject(requirementsResult.rows);
  const eventsByProject = groupByProject(eventsResult.rows);
  const matchByProject = new Map(spatialMatches.map((item) => [item.projectId, item]));
  const alertsByProject = new Map<string, AlertSeverity[]>();
  for (const row of alertsResult.rows) {
    if (!row.project_id || !isAlertSeverity(row.severity)) {
      continue;
    }
    const existing = alertsByProject.get(row.project_id) ?? [];
    existing.push(row.severity);
    alertsByProject.set(row.project_id, existing);
  }

  const inputs: PortfolioAttentionProjectInput[] = projectMetaResult.rows.map((row) => {
    const projectRequirements = requirementsByProject.get(row.id) ?? [];
    const mappedRequirements = projectRequirements.map((item) => ({
      id: item.id,
      label: item.label,
      required: item.required === true,
      status: checklistStatusLabel(item.status) as ChecklistStatus,
      dueDate: item.due_date,
    }));
    const readiness = applicationReadinessFromRequirements(mappedRequirements);
    const projectCase = casesByProject.get(row.id)?.[0] ?? null;
    const events = (eventsByProject.get(row.id) ?? []).map((event) => ({
      title: event.title,
      occurredAt: event.occurred_at,
    }));
    const match = matchByProject.get(row.id);
    const hasCoordinates = Boolean(match);

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      stage: pipelineStageLabel(row.connection_stage),
      connectionCaseStatus: projectCase ? connectionCaseStatusLabel(projectCase.status) : null,
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
      connectionDeadline: projectCase?.deadline ?? null,
      nextMilestone: projectCase ? projectCase.next_milestone ?? "" : undefined,
      connectionCaseCreatedAt: projectCase?.created_at ?? null,
      connectionCaseOwnerAssigned: projectCase ? Boolean(projectCase.owner_id) : null,
      events,
      lastActivityAt: events[0]?.occurredAt ?? null,
      unmatchedOfficialGeography:
        matchByProject.size === 0 ? undefined : isUnmatchedReviewProject(match, hasCoordinates),
    };
  });

  return { inputs, error: null };
}
