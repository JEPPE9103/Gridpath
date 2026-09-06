"use server";

import {
  canAddProjectToComparison,
  canWritePortfolioComparisons,
  normalizeComparisonName,
  planComparisonProjectUpdate,
  validateComparisonName,
  validateComparisonProjectCount,
} from "@/lib/compare/comparison-rules";
import { getCurrentOrganization } from "@/lib/data/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ComparisonActionResult =
  | { ok: true; comparisonId: string }
  | { ok: false; error: string };

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function revalidateComparisonPaths(comparisonId?: string) {
  revalidatePath("/map");
  revalidatePath("/compare");
  if (comparisonId) {
    revalidatePath(`/compare/${comparisonId}`);
  }
}

async function loadProjectsForOrganization(
  organizationId: string,
  projectIds: string[],
): Promise<Array<{ id: string; organization_id: string; archived_at: string | null }> | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, organization_id, archived_at")
    .eq("organization_id", organizationId)
    .in("id", projectIds);
  if (error) {
    console.error("loadProjectsForOrganization failed", error.message);
    return null;
  }
  return (data ?? []) as Array<{ id: string; organization_id: string; archived_at: string | null }>;
}

export async function savePortfolioComparison(input: {
  name: string;
  projectIds: string[];
}): Promise<ComparisonActionResult> {
  const nameError = validateComparisonName(input.name);
  if (nameError) {
    return { ok: false, error: nameError };
  }
  const uniqueIds = [...new Set(input.projectIds.filter(isUuid))];
  const countError = validateComparisonProjectCount(uniqueIds.length);
  if (countError) {
    return { ok: false, error: countError };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canWritePortfolioComparisons(organization.role)) {
    return { ok: false, error: "You do not have permission to save comparisons." };
  }

  const projects = await loadProjectsForOrganization(organization.id, uniqueIds);
  if (!projects || projects.length !== uniqueIds.length) {
    return { ok: false, error: "Every selected project must belong to this workspace." };
  }

  for (const project of projects) {
    const allowed = canAddProjectToComparison({
      projectOrganizationId: project.organization_id,
      comparisonOrganizationId: organization.id,
      archivedAt: project.archived_at,
      alreadyInComparison: false,
    });
    if (!allowed.ok) {
      return { ok: false, error: allowed.error };
    }
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to save a comparison." };
  }

  const { data: created, error: insertError } = await supabase
    .from("portfolio_comparisons")
    .insert({
      organization_id: organization.id,
      name: normalizeComparisonName(input.name),
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !created) {
    if (insertError) {
      console.error("savePortfolioComparison insert failed", insertError.message);
    }
    return { ok: false, error: "Could not save the comparison." };
  }

  const { error: linkError } = await supabase.from("portfolio_comparison_projects").insert(
    uniqueIds.map((projectId, index) => ({
      comparison_id: created.id,
      project_id: projectId,
      sort_order: index,
    })),
  );

  if (linkError) {
    console.error("savePortfolioComparison projects failed", linkError.message);
    await supabase.from("portfolio_comparisons").delete().eq("id", created.id);
    return { ok: false, error: "Could not save the selected projects." };
  }

  revalidateComparisonPaths(created.id);
  return { ok: true, comparisonId: created.id };
}

export async function renamePortfolioComparison(
  comparisonId: string,
  name: string,
): Promise<ComparisonActionResult> {
  if (!isUuid(comparisonId)) {
    return { ok: false, error: "Could not rename that comparison." };
  }
  const nameError = validateComparisonName(name);
  if (nameError) {
    return { ok: false, error: nameError };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canWritePortfolioComparisons(organization.role)) {
    return { ok: false, error: "You do not have permission to rename comparisons." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("portfolio_comparisons")
    .update({ name: normalizeComparisonName(name) })
    .eq("id", comparisonId)
    .eq("organization_id", organization.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("renamePortfolioComparison failed", error.message);
    }
    return { ok: false, error: "Could not rename the comparison." };
  }

  revalidateComparisonPaths(comparisonId);
  return { ok: true, comparisonId };
}

export async function deletePortfolioComparison(
  comparisonId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isUuid(comparisonId)) {
    return { ok: false, error: "Could not delete that comparison." };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canWritePortfolioComparisons(organization.role)) {
    return { ok: false, error: "You do not have permission to delete comparisons." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("portfolio_comparisons")
    .delete()
    .eq("id", comparisonId)
    .eq("organization_id", organization.id);

  if (error) {
    console.error("deletePortfolioComparison failed", error.message);
    return { ok: false, error: "Could not delete the comparison." };
  }

  revalidateComparisonPaths();
  return { ok: true };
}

export async function updatePortfolioComparisonProjects(
  comparisonId: string,
  projectIds: string[],
): Promise<ComparisonActionResult> {
  if (!isUuid(comparisonId)) {
    return { ok: false, error: "Could not update that comparison." };
  }

  const uniqueIds = [...new Set(projectIds.filter(isUuid))];
  return replaceComparisonProjects(comparisonId, uniqueIds);
}

export async function updatePortfolioComparisonFromSlugs(
  comparisonId: string,
  slugs: string[],
): Promise<ComparisonActionResult> {
  if (!isUuid(comparisonId)) {
    return { ok: false, error: "Could not update that comparison." };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canWritePortfolioComparisons(organization.role)) {
    return { ok: false, error: "You do not have permission to update comparisons." };
  }

  const normalized = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  const countError = validateComparisonProjectCount(normalized.length);
  if (countError) {
    return { ok: false, error: countError };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, slug")
    .eq("organization_id", organization.id)
    .in("slug", normalized);

  if (error) {
    console.error("updatePortfolioComparisonFromSlugs failed", error.message);
    return { ok: false, error: "Could not update that comparison." };
  }

  const rows = (data ?? []) as Array<{ id: string; slug: string }>;
  const idBySlug = new Map(rows.map((row) => [row.slug, row.id]));
  const projectIds = normalized
    .map((slug) => idBySlug.get(slug))
    .filter((id): id is string => Boolean(id));

  if (projectIds.length !== normalized.length) {
    return {
      ok: false,
      error: "Temporary compare includes a project that is not in this workspace.",
    };
  }

  return replaceComparisonProjects(comparisonId, projectIds);
}

async function replaceComparisonProjects(
  comparisonId: string,
  uniqueIds: string[],
): Promise<ComparisonActionResult> {
  const countError = validateComparisonProjectCount(uniqueIds.length);
  if (countError) {
    return { ok: false, error: countError };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canWritePortfolioComparisons(organization.role)) {
    return { ok: false, error: "You do not have permission to update comparisons." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: comparison, error: loadError } = await supabase
    .from("portfolio_comparisons")
    .select("id")
    .eq("id", comparisonId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (loadError || !comparison) {
    if (loadError) {
      console.error("updatePortfolioComparisonProjects load failed", loadError.message);
    }
    return { ok: false, error: "Could not update that comparison." };
  }

  const { data: existingLinks, error: existingError } = await supabase
    .from("portfolio_comparison_projects")
    .select("project_id")
    .eq("comparison_id", comparisonId);

  if (existingError) {
    console.error("updatePortfolioComparisonProjects existing failed", existingError.message);
    return { ok: false, error: "Could not update that comparison." };
  }

  const existingIds = ((existingLinks ?? []) as Array<{ project_id: string }>).map(
    (row) => row.project_id,
  );
  const plan = planComparisonProjectUpdate({
    existingProjectIds: existingIds,
    nextProjectIds: uniqueIds,
  });

  const projects = await loadProjectsForOrganization(organization.id, uniqueIds);
  if (!projects || projects.length !== uniqueIds.length) {
    return { ok: false, error: "Every selected project must belong to this workspace." };
  }

  const already = new Set(existingIds);
  for (const project of projects) {
    const allowed = canAddProjectToComparison({
      projectOrganizationId: project.organization_id,
      comparisonOrganizationId: organization.id,
      archivedAt: project.archived_at,
      alreadyInComparison: already.has(project.id),
    });
    if (!allowed.ok) {
      return { ok: false, error: allowed.error };
    }
  }

  if (plan.toRemove.length > 0) {
    const { error: removeError } = await supabase
      .from("portfolio_comparison_projects")
      .delete()
      .eq("comparison_id", comparisonId)
      .in("project_id", plan.toRemove);
    if (removeError) {
      console.error("updatePortfolioComparisonProjects remove failed", removeError.message);
      return { ok: false, error: "Could not update the comparison." };
    }
  }

  if (plan.toAdd.length > 0) {
    const { error: addError } = await supabase.from("portfolio_comparison_projects").insert(
      plan.toAdd.map((projectId, index) => ({
        comparison_id: comparisonId,
        project_id: projectId,
        sort_order: existingIds.length + index,
      })),
    );
    if (addError) {
      console.error("updatePortfolioComparisonProjects add failed", addError.message);
      return { ok: false, error: "Could not add those projects." };
    }
  }

  await supabase
    .from("portfolio_comparisons")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", comparisonId);

  revalidateComparisonPaths(comparisonId);
  return { ok: true, comparisonId };
}

