"use server";

import { getCurrentOrganization } from "@/lib/data/organization";
import {
  checklistStatusLabel,
  checklistStatusToDb,
  isChecklistStatus,
} from "@/lib/domain/catalog-labels";
import { canAdminWorkflow, canWriteWorkflow } from "@/lib/projects/authorization";
import {
  parseRequirementForm,
  type RequirementFieldErrors,
  type RequirementFormInput,
} from "@/lib/requirements/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ChecklistStatus } from "@/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;

export type RequirementMutationState = {
  error?: string;
  fieldErrors?: RequirementFieldErrors;
  values?: RequirementFormInput;
  saved?: boolean;
};

type RequirementProjectEmbed = {
  id: string;
  slug: string;
  organization_id: string;
};

type RequirementRow = {
  id: string;
  project_id: string;
  label: string;
  status: string;
  projects: RequirementProjectEmbed | RequirementProjectEmbed[] | null;
};

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function revalidateRequirementPaths(slug: string) {
  revalidatePath("/overview");
  revalidatePath("/portfolio");
  revalidatePath("/map");
  revalidatePath("/reports");
  revalidatePath(`/projects/${slug}`);
}

export async function updateRequirementStatus(
  requirementId: string,
  status: ChecklistStatus,
  projectSlug: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_PATTERN.test(requirementId) || !SLUG_PATTERN.test(projectSlug) || !isChecklistStatus(status)) {
    return { ok: false, error: "Could not update requirement." };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canWriteWorkflow(organization.role)) {
    return { ok: false, error: "Could not update requirement." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: loadError } = await supabase
    .from("project_requirements")
    .select("id, project_id, label, status, projects!inner ( id, slug, organization_id )")
    .eq("id", requirementId)
    .maybeSingle();

  if (loadError || !data) {
    if (loadError) {
      console.error("updateRequirementStatus load failed", loadError.message);
    }
    return { ok: false, error: "Could not update requirement." };
  }

  const requirement = data as RequirementRow;
  const project = asSingle(requirement.projects);
  if (
    !project ||
    project.organization_id !== organization.id ||
    project.slug !== projectSlug
  ) {
    return { ok: false, error: "Could not update requirement." };
  }

  const nextStatus = checklistStatusToDb(status);
  if (requirement.status === nextStatus) {
    revalidateRequirementPaths(projectSlug);
    return { ok: true };
  }

  const { data: updated, error: updateError } = await supabase
    .from("project_requirements")
    .update({ status: nextStatus })
    .eq("id", requirementId)
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    if (updateError) {
      console.error("updateRequirementStatus update failed", updateError.message);
    }
    return { ok: false, error: "Could not update requirement." };
  }

  if (status === "Complete") {
    const { error: eventError } = await supabase.from("project_events").insert({
      project_id: requirement.project_id,
      title: "Requirement completed",
      detail: `${requirement.label}: ${checklistStatusLabel(requirement.status)} → ${status}`,
      source: "Customer Data",
    });
    if (eventError) {
      console.error("updateRequirementStatus event failed", eventError.message);
    }
  }

  revalidateRequirementPaths(projectSlug);
  return { ok: true };
}

export async function markRequirementComplete(
  requirementId: string,
  projectSlug: string,
): Promise<{ ok: boolean; error?: string }> {
  return updateRequirementStatus(requirementId, "Complete", projectSlug);
}

export async function createRequirementAction(
  _previous: RequirementMutationState,
  formData: FormData,
): Promise<RequirementMutationState> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const projectSlug = String(formData.get("projectSlug") ?? "").trim();
  const connectionCaseId = String(formData.get("connectionCaseId") ?? "").trim();
  const { values, parsed, fieldErrors } = parseRequirementForm(formData);

  if (!UUID_PATTERN.test(projectId) || !SLUG_PATTERN.test(projectSlug)) {
    return { error: "Could not create the requirement.", values };
  }

  if (!parsed) {
    return { error: "Check the highlighted fields.", fieldErrors, values };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canWriteWorkflow(organization.role)) {
    return { error: "You do not have permission to add requirements.", values };
  }

  const supabase = await createSupabaseServerClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, slug, organization_id")
    .eq("id", projectId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (projectError || !project || project.slug !== projectSlug) {
    if (projectError) {
      console.error("createRequirementAction project failed", projectError.message);
    }
    return { error: "Could not create the requirement.", values };
  }

  let linkedCaseId: string | null = null;
  if (connectionCaseId) {
    if (!UUID_PATTERN.test(connectionCaseId)) {
      return { error: "Could not create the requirement.", values };
    }
    const { data: caseRow } = await supabase
      .from("connection_cases")
      .select("id")
      .eq("id", connectionCaseId)
      .eq("project_id", project.id)
      .maybeSingle();
    linkedCaseId = caseRow?.id ?? null;
  }

  const { data: created, error } = await supabase
    .from("project_requirements")
    .insert({
      project_id: project.id,
      connection_case_id: linkedCaseId,
      label: parsed.label,
      category: parsed.category,
      required: parsed.required,
      status: parsed.status,
      due_date: parsed.dueDate,
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    console.error("createRequirementAction failed", error?.message);
    return { error: "Could not create the requirement.", values };
  }

  const { error: eventError } = await supabase.from("project_events").insert({
    project_id: project.id,
    title: "Requirement added",
    detail: parsed.label,
    source: "Customer Data",
  });
  if (eventError) {
    console.error("createRequirementAction event failed", eventError.message);
  }

  revalidateRequirementPaths(project.slug);
  redirect(`/projects/${project.slug}?tab=overview`);
}

export async function updateRequirementAction(
  _previous: RequirementMutationState,
  formData: FormData,
): Promise<RequirementMutationState> {
  const requirementId = String(formData.get("requirementId") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const projectSlug = String(formData.get("projectSlug") ?? "").trim();
  const { values, parsed, fieldErrors } = parseRequirementForm(formData);

  if (
    !UUID_PATTERN.test(requirementId) ||
    !UUID_PATTERN.test(projectId) ||
    !SLUG_PATTERN.test(projectSlug)
  ) {
    return { error: "Could not update the requirement.", values };
  }

  if (!parsed) {
    return { error: "Check the highlighted fields.", fieldErrors, values };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canWriteWorkflow(organization.role)) {
    return { error: "You do not have permission to edit requirements.", values };
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: loadError } = await supabase
    .from("project_requirements")
    .select("id, project_id, label, status, projects!inner ( id, slug, organization_id )")
    .eq("id", requirementId)
    .maybeSingle();

  if (loadError || !existing) {
    if (loadError) {
      console.error("updateRequirementAction load failed", loadError.message);
    }
    return { error: "Could not update the requirement.", values };
  }

  const requirement = existing as RequirementRow;
  const project = asSingle(requirement.projects);
  if (
    !project ||
    project.organization_id !== organization.id ||
    project.id !== projectId ||
    project.slug !== projectSlug
  ) {
    return { error: "Could not update the requirement.", values };
  }

  const { data: updated, error } = await supabase
    .from("project_requirements")
    .update({
      label: parsed.label,
      category: parsed.category,
      required: parsed.required,
      status: parsed.status,
      due_date: parsed.dueDate,
    })
    .eq("id", requirementId)
    .eq("project_id", project.id)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    console.error("updateRequirementAction failed", error?.message);
    return { error: "Could not update the requirement.", values };
  }

  if (requirement.status !== parsed.status && parsed.status === "complete") {
    const { error: eventError } = await supabase.from("project_events").insert({
      project_id: project.id,
      title: "Requirement completed",
      detail: parsed.label,
      source: "Customer Data",
    });
    if (eventError) {
      console.error("updateRequirementAction event failed", eventError.message);
    }
  }

  revalidateRequirementPaths(project.slug);
  redirect(`/projects/${project.slug}?tab=overview`);
}

export async function deleteRequirementAction(
  requirementId: string,
  projectSlug: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_PATTERN.test(requirementId) || !SLUG_PATTERN.test(projectSlug)) {
    return { ok: false, error: "Could not delete the requirement." };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canAdminWorkflow(organization.role)) {
    return { ok: false, error: "You do not have permission to delete requirements." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: loadError } = await supabase
    .from("project_requirements")
    .select("id, project_id, label, projects!inner ( id, slug, organization_id )")
    .eq("id", requirementId)
    .maybeSingle();

  if (loadError || !existing) {
    if (loadError) {
      console.error("deleteRequirementAction load failed", loadError.message);
    }
    return { ok: false, error: "Could not delete the requirement." };
  }

  const requirement = existing as RequirementRow;
  const project = asSingle(requirement.projects);
  if (
    !project ||
    project.organization_id !== organization.id ||
    project.slug !== projectSlug
  ) {
    return { ok: false, error: "Could not delete the requirement." };
  }

  const { error } = await supabase
    .from("project_requirements")
    .delete()
    .eq("id", requirementId)
    .eq("project_id", project.id);

  if (error) {
    console.error("deleteRequirementAction failed", error.message);
    return { ok: false, error: "Could not delete the requirement." };
  }

  revalidateRequirementPaths(project.slug);
  return { ok: true };
}
