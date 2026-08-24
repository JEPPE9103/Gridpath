"use server";

import { getCurrentOrganization } from "@/lib/data/organization";
import { canCreateOrEditProjects, canDeleteProjects } from "@/lib/projects/authorization";
import { parseProjectForm, type ProjectFormFieldErrors, type ProjectFormInput } from "@/lib/projects/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProjectMutationState = {
  error?: string;
  fieldErrors?: ProjectFormFieldErrors;
  values?: ProjectFormInput;
};

type RpcRow = {
  project_id: string;
  slug: string;
};

function revalidateProjectPaths(slug?: string) {
  revalidatePath("/overview");
  revalidatePath("/portfolio");
  revalidatePath("/map");
  revalidatePath("/reports");
  revalidatePath("/connections");
  revalidatePath("/documents");
  revalidatePath("/changes");
  if (slug) {
    revalidatePath(`/projects/${slug}`);
    revalidatePath(`/projects/${slug}/edit`);
  }
}

function publicError(message: string | undefined, fallback: string): string {
  const text = (message ?? "").toLowerCase();
  if (text.includes("not authenticated") || text.includes("no organization")) {
    return "Sign in to manage projects.";
  }
  if (text.includes("not allowed") || text.includes("permission") || text.includes("42501")) {
    return "You do not have permission to do that.";
  }
  if (text.includes("invalid coordinates")) {
    return "Check the latitude and longitude.";
  }
  if (text.includes("invalid technology")) {
    return "Select a valid technology.";
  }
  if (text.includes("grid operator")) {
    return "Select a valid grid operator.";
  }
  if (text.includes("negative")) {
    return "Import and export MW cannot be negative.";
  }
  if (text.includes("name is required")) {
    return "Enter a project name.";
  }
  return fallback;
}

export async function createProjectAction(
  _previous: ProjectMutationState,
  formData: FormData,
): Promise<ProjectMutationState> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { error: "Sign in to create a project." };
  }
  if (!canCreateOrEditProjects(organization.role)) {
    return { error: "You do not have permission to create projects." };
  }

  const { values, parsed, fieldErrors } = parseProjectForm(formData);
  if (!parsed) {
    return { error: "Check the highlighted fields.", fieldErrors, values };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_project_with_primary_site", {
    p_name: parsed.name,
    p_technology: parsed.technology,
    p_location: parsed.location,
    p_latitude: parsed.latitude,
    p_longitude: parsed.longitude,
    p_import_mw: parsed.importMw,
    p_export_mw: parsed.exportMw,
    p_grid_operator_id: parsed.gridOperatorId,
    p_connection_stage: parsed.connectionStage,
    p_connection_outlook: parsed.connectionOutlook,
    p_confidence: parsed.confidence,
    p_target_cod: parsed.targetCod,
  });

  if (error || !data) {
    console.error("createProjectAction failed", error?.message);
    return {
      error: publicError(error?.message, "Could not create the project."),
      values,
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as RpcRow | undefined;
  if (!row?.slug) {
    return { error: "Could not create the project.", values };
  }

  revalidateProjectPaths(row.slug);
  redirect(`/projects/${row.slug}`);
}

export async function updateProjectAction(
  projectId: string,
  _previous: ProjectMutationState,
  formData: FormData,
): Promise<ProjectMutationState> {
  if (!UUID_PATTERN.test(projectId)) {
    return { error: "Could not update the project." };
  }

  const organization = await getCurrentOrganization();
  if (!organization) {
    return { error: "Sign in to edit a project." };
  }
  if (!canCreateOrEditProjects(organization.role)) {
    return { error: "You do not have permission to edit projects." };
  }

  const { values, parsed, fieldErrors } = parseProjectForm(formData);
  if (!parsed) {
    return { error: "Check the highlighted fields.", fieldErrors, values };
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: loadError } = await supabase
    .from("projects")
    .select("id, slug, organization_id")
    .eq("id", projectId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (loadError || !existing) {
    if (loadError) {
      console.error("updateProjectAction load failed", loadError.message);
    }
    return { error: "Could not update the project." };
  }

  const { data, error } = await supabase.rpc("update_project_with_primary_site", {
    p_project_id: projectId,
    p_name: parsed.name,
    p_technology: parsed.technology,
    p_location: parsed.location,
    p_latitude: parsed.latitude,
    p_longitude: parsed.longitude,
    p_import_mw: parsed.importMw,
    p_export_mw: parsed.exportMw,
    p_grid_operator_id: parsed.gridOperatorId,
    p_connection_stage: parsed.connectionStage,
    p_connection_outlook: parsed.connectionOutlook,
    p_confidence: parsed.confidence,
    p_target_cod: parsed.targetCod,
  });

  if (error || !data) {
    console.error("updateProjectAction failed", error?.message);
    return {
      error: publicError(error?.message, "Could not update the project."),
      values,
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as RpcRow | undefined;
  const slug = row?.slug || existing.slug;
  revalidateProjectPaths(slug);
  redirect(`/projects/${slug}`);
}

export async function deleteProjectAction(
  projectId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_PATTERN.test(projectId)) {
    return { ok: false, error: "Could not delete the project." };
  }

  const organization = await getCurrentOrganization();
  if (!organization) {
    return { ok: false, error: "Sign in to delete a project." };
  }
  if (!canDeleteProjects(organization.role)) {
    return { ok: false, error: "You do not have permission to delete projects." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: existing, error: loadError } = await supabase
    .from("projects")
    .select("id, slug, organization_id")
    .eq("id", projectId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (loadError || !existing) {
    if (loadError) {
      console.error("deleteProjectAction load failed", loadError.message);
    }
    return { ok: false, error: "Could not delete the project." };
  }

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", existing.id)
    .eq("organization_id", organization.id);

  if (error) {
    console.error("deleteProjectAction failed", error.message);
    return { ok: false, error: "Could not delete the project." };
  }

  revalidateProjectPaths(existing.slug);
  redirect("/portfolio");
}
