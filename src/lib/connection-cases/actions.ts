"use server";

import {
  parseConnectionCaseForm,
  type ConnectionCaseFieldErrors,
  type ConnectionCaseFormInput,
} from "@/lib/connection-cases/validation";
import { getCurrentOrganization } from "@/lib/data/organization";
import { canAdminWorkflow, canWriteWorkflow } from "@/lib/projects/authorization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;

export type ConnectionCaseMutationState = {
  error?: string;
  fieldErrors?: ConnectionCaseFieldErrors;
  values?: ConnectionCaseFormInput;
};

type ProjectRow = {
  id: string;
  slug: string;
  organization_id: string;
  grid_operator_id: string | null;
  connection_stage: string;
};

function revalidateCasePaths(slug: string) {
  revalidatePath("/overview");
  revalidatePath("/portfolio");
  revalidatePath("/map");
  revalidatePath("/reports");
  revalidatePath("/connections");
  revalidatePath(`/projects/${slug}`);
}

async function loadProjectInOrg(
  projectId: string,
  organizationId: string,
): Promise<ProjectRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, slug, organization_id, grid_operator_id, connection_stage")
    .eq("id", projectId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("loadProjectInOrg failed", error.message);
    return null;
  }

  return (data as ProjectRow | null) ?? null;
}

export async function createConnectionCaseAction(
  _previous: ConnectionCaseMutationState,
  formData: FormData,
): Promise<ConnectionCaseMutationState> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const projectSlug = String(formData.get("projectSlug") ?? "").trim();
  const { values, parsed, fieldErrors } = parseConnectionCaseForm(formData);

  if (!UUID_PATTERN.test(projectId) || !SLUG_PATTERN.test(projectSlug)) {
    return { error: "Could not create the connection case.", values };
  }

  if (!parsed) {
    return { error: "Check the highlighted fields.", fieldErrors, values };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canWriteWorkflow(organization.role)) {
    return { error: "You do not have permission to create a connection case.", values };
  }

  const project = await loadProjectInOrg(projectId, organization.id);
  if (!project || project.slug !== projectSlug) {
    return { error: "Could not create the connection case.", values };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Sign in to create a connection case.", values };
  }

  const { data: existing } = await supabase
    .from("connection_cases")
    .select("id")
    .eq("project_id", project.id)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return {
      error: "This project already has a connection process. Edit the existing case instead.",
      values,
    };
  }

  const { data: created, error } = await supabase
    .from("connection_cases")
    .insert({
      project_id: project.id,
      grid_operator_id: parsed.gridOperatorId,
      owner_id: user.id,
      case_id: parsed.caseId,
      stage: parsed.stage,
      status: parsed.status,
      submitted_at: parsed.submittedAt,
      next_milestone: parsed.nextMilestone,
      deadline: parsed.deadline,
      notes: parsed.notes,
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    console.error("createConnectionCaseAction failed", error?.message);
    return { error: "Could not create the connection case.", values };
  }

  if (project.connection_stage !== parsed.stage) {
    const { error: projectError } = await supabase
      .from("projects")
      .update({ connection_stage: parsed.stage })
      .eq("id", project.id)
      .eq("organization_id", organization.id);
    if (projectError) {
      console.error("createConnectionCaseAction project stage failed", projectError.message);
    }
  }

  const { error: eventError } = await supabase.from("project_events").insert({
    project_id: project.id,
    title: "Connection process started",
    detail: `Stage ${parsed.stage.replaceAll("_", " ")} · status ${parsed.status.replaceAll("_", " ")}`,
    source: "Customer Data",
  });
  if (eventError) {
    console.error("createConnectionCaseAction event failed", eventError.message);
  }

  revalidateCasePaths(project.slug);
  redirect(`/projects/${project.slug}?tab=connection`);
}

export async function updateConnectionCaseAction(
  _previous: ConnectionCaseMutationState,
  formData: FormData,
): Promise<ConnectionCaseMutationState> {
  const caseId = String(formData.get("caseIdKey") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const projectSlug = String(formData.get("projectSlug") ?? "").trim();
  const { values, parsed, fieldErrors } = parseConnectionCaseForm(formData);

  if (
    !UUID_PATTERN.test(caseId) ||
    !UUID_PATTERN.test(projectId) ||
    !SLUG_PATTERN.test(projectSlug)
  ) {
    return { error: "Could not update the connection case.", values };
  }

  if (!parsed) {
    return { error: "Check the highlighted fields.", fieldErrors, values };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canWriteWorkflow(organization.role)) {
    return { error: "You do not have permission to edit this connection case.", values };
  }

  const project = await loadProjectInOrg(projectId, organization.id);
  if (!project || project.slug !== projectSlug) {
    return { error: "Could not update the connection case.", values };
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: loadError } = await supabase
    .from("connection_cases")
    .select("id, project_id, stage, status")
    .eq("id", caseId)
    .eq("project_id", project.id)
    .maybeSingle();

  if (loadError || !existing) {
    if (loadError) {
      console.error("updateConnectionCaseAction load failed", loadError.message);
    }
    return { error: "Could not update the connection case.", values };
  }

  const { data: updated, error } = await supabase
    .from("connection_cases")
    .update({
      grid_operator_id: parsed.gridOperatorId,
      case_id: parsed.caseId,
      stage: parsed.stage,
      status: parsed.status,
      submitted_at: parsed.submittedAt,
      next_milestone: parsed.nextMilestone,
      deadline: parsed.deadline,
      notes: parsed.notes,
    })
    .eq("id", caseId)
    .eq("project_id", project.id)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    console.error("updateConnectionCaseAction failed", error?.message);
    return { error: "Could not update the connection case.", values };
  }

  if (project.connection_stage !== parsed.stage) {
    const { error: projectError } = await supabase
      .from("projects")
      .update({ connection_stage: parsed.stage })
      .eq("id", project.id)
      .eq("organization_id", organization.id);
    if (projectError) {
      console.error("updateConnectionCaseAction project stage failed", projectError.message);
    }
  }

  const stageChanged = existing.stage !== parsed.stage;
  const statusChanged = existing.status !== parsed.status;
  if (stageChanged || statusChanged) {
    const { error: eventError } = await supabase.from("project_events").insert({
      project_id: project.id,
      title: "Connection case updated",
      detail: [
        stageChanged
          ? `Stage ${existing.stage.replaceAll("_", " ")} → ${parsed.stage.replaceAll("_", " ")}`
          : null,
        statusChanged
          ? `Status ${existing.status.replaceAll("_", " ")} → ${parsed.status.replaceAll("_", " ")}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      source: "Customer Data",
    });
    if (eventError) {
      console.error("updateConnectionCaseAction event failed", eventError.message);
    }
  }

  revalidateCasePaths(project.slug);
  redirect(`/projects/${project.slug}?tab=connection`);
}

export async function deleteConnectionCaseAction(
  caseId: string,
  projectSlug: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_PATTERN.test(caseId) || !SLUG_PATTERN.test(projectSlug)) {
    return { ok: false, error: "Could not delete the connection case." };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canAdminWorkflow(organization.role)) {
    return { ok: false, error: "You do not have permission to delete this connection case." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: loadError } = await supabase
    .from("connection_cases")
    .select("id, project_id, projects!inner ( id, slug, organization_id )")
    .eq("id", caseId)
    .maybeSingle();

  if (loadError || !existing) {
    if (loadError) {
      console.error("deleteConnectionCaseAction load failed", loadError.message);
    }
    return { ok: false, error: "Could not delete the connection case." };
  }

  const projectEmbed = existing.projects as
    | { id: string; slug: string; organization_id: string }
    | { id: string; slug: string; organization_id: string }[]
    | null;
  const project = Array.isArray(projectEmbed) ? projectEmbed[0] : projectEmbed;
  if (
    !project ||
    project.organization_id !== organization.id ||
    project.slug !== projectSlug
  ) {
    return { ok: false, error: "Could not delete the connection case." };
  }

  const { error } = await supabase
    .from("connection_cases")
    .delete()
    .eq("id", caseId)
    .eq("project_id", project.id);

  if (error) {
    console.error("deleteConnectionCaseAction failed", error.message);
    return { ok: false, error: "Could not delete the connection case." };
  }

  const { error: eventError } = await supabase.from("project_events").insert({
    project_id: project.id,
    title: "Connection case deleted",
    detail: "The connection process record was removed.",
    source: "Customer Data",
  });
  if (eventError) {
    console.error("deleteConnectionCaseAction event failed", eventError.message);
  }

  revalidateCasePaths(project.slug);
  return { ok: true };
}
