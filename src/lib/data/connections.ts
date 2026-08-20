import { getCurrentOrganization } from "@/lib/data/organization";
import type {
  ConnectionCaseListItem,
  ConnectionCasesResult,
} from "@/lib/data/connections-types";
import { asSingle } from "@/lib/data/row-utils";
import { deadlineAttention } from "@/lib/domain/connection-deadlines";
import {
  connectionCaseStatusLabel,
  pipelineStageLabel,
} from "@/lib/domain/catalog-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type {
  ConnectionCaseListItem,
  ConnectionCaseListStatus,
  ConnectionCasesResult,
} from "@/lib/data/connections-types";
export {
  CONNECTION_CASE_STATUS_FILTERS,
  isActiveConnectionCase,
} from "@/lib/data/connections-types";

type GridOperatorRow = { name: string };

type ProjectEmbed = {
  id: string;
  name: string;
  slug: string;
  organization_id: string;
};

type ProfileRow = { id: string; full_name: string | null };

type CaseRow = {
  id: string;
  case_id: string | null;
  stage: string;
  status: string;
  submitted_at: string | null;
  next_milestone: string | null;
  deadline: string | null;
  notes: string | null;
  owner_id: string | null;
  updated_at: string;
  grid_operators: GridOperatorRow | GridOperatorRow[] | null;
  projects: ProjectEmbed | ProjectEmbed[] | null;
};

function profileName(profiles: ProfileRow[], id: string | null): string | null {
  if (!id) {
    return null;
  }
  const name = profiles.find((row) => row.id === id)?.full_name?.trim();
  return name || null;
}

function mapCase(row: CaseRow, profiles: ProfileRow[]): ConnectionCaseListItem | null {
  const project = asSingle(row.projects);
  if (!project?.slug) {
    return null;
  }
  const operator = asSingle(row.grid_operators);
  const deadline = row.deadline;

  return {
    id: row.id,
    projectName: project.name,
    projectSlug: project.slug,
    gridOperator: operator?.name ?? "",
    caseId: row.case_id,
    stage: pipelineStageLabel(row.stage),
    submittedAt: row.submitted_at,
    nextMilestone: row.next_milestone,
    deadline,
    ownerName: profileName(profiles, row.owner_id),
    status: connectionCaseStatusLabel(row.status),
    notes: row.notes?.trim() || null,
    updatedAt: row.updated_at,
    deadlineAttention: deadlineAttention(deadline),
  };
}

export async function getConnectionCasesForCurrentOrganization(): Promise<ConnectionCasesResult> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { kind: "no_organization" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("connection_cases")
    .select(
      `
      id,
      case_id,
      stage,
      status,
      submitted_at,
      next_milestone,
      deadline,
      notes,
      owner_id,
      updated_at,
      grid_operators ( name ),
      projects!inner ( id, name, slug, organization_id )
    `,
    )
    .eq("projects.organization_id", organization.id)
    .order("deadline", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("getConnectionCasesForCurrentOrganization failed", error.message);
    return { kind: "error", message: "Could not load connection cases." };
  }

  const rows = (data ?? []) as CaseRow[];
  const ownerIds = [
    ...new Set(rows.map((row) => row.owner_id).filter((id): id is string => Boolean(id))),
  ];

  let profiles: ProfileRow[] = [];
  if (ownerIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ownerIds);
    if (profileError) {
      console.error("getConnectionCasesForCurrentOrganization profiles failed", profileError.message);
    } else {
      profiles = (profileRows ?? []) as ProfileRow[];
    }
  }

  return {
    kind: "ok",
    cases: rows
      .map((row) => mapCase(row, profiles))
      .filter((item): item is ConnectionCaseListItem => item !== null),
  };
}
