"use server";

import { getCurrentOrganization } from "@/lib/data/organization";
import {
  checklistStatusLabel,
  checklistStatusToDb,
  isChecklistStatus,
} from "@/lib/domain/catalog-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ChecklistStatus } from "@/types";
import { revalidatePath } from "next/cache";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;

function canWrite(role: string): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

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

export async function updateRequirementStatus(
  requirementId: string,
  status: ChecklistStatus,
  projectSlug: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_PATTERN.test(requirementId) || !SLUG_PATTERN.test(projectSlug) || !isChecklistStatus(status)) {
    return { ok: false, error: "Could not update requirement." };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canWrite(organization.role)) {
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
    revalidatePath(`/projects/${projectSlug}`);
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

  const { error: eventError } = await supabase.from("project_events").insert({
    project_id: requirement.project_id,
    title: "Requirement status updated",
    detail: `${requirement.label}: ${checklistStatusLabel(requirement.status)} → ${status}`,
    source: "Customer Data",
  });
  if (eventError) {
    console.error("updateRequirementStatus event failed", eventError.message);
  }

  revalidatePath(`/projects/${projectSlug}`);
  return { ok: true };
}

export async function markRequirementComplete(
  requirementId: string,
  projectSlug: string,
): Promise<{ ok: boolean; error?: string }> {
  return updateRequirementStatus(requirementId, "Complete", projectSlug);
}
