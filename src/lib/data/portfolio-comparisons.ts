import { getCurrentOrganization } from "@/lib/data/organization";
import { getMapProjectsByIds } from "@/lib/data/map-projects";
import type { MapProject } from "@/lib/data/map-types";
import { canWritePortfolioComparisons } from "@/lib/compare/comparison-rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SavedComparisonSummary = {
  id: string;
  name: string;
  projectCount: number;
  updatedAt: string;
  createdAt: string;
  createdByName: string | null;
  hasArchivedProjects: boolean;
};

export type SavedComparisonDetail = {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  createdByName: string | null;
  canWrite: boolean;
  projects: MapProject[];
};

export type SavedComparisonsResult =
  | { kind: "ok"; comparisons: SavedComparisonSummary[]; canWrite: boolean }
  | { kind: "no_organization" }
  | { kind: "error"; message: string };

export type SavedComparisonDetailResult =
  | { kind: "ok"; comparison: SavedComparisonDetail }
  | { kind: "not_found" }
  | { kind: "no_organization" }
  | { kind: "error"; message: string };

type ComparisonRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

type ComparisonProjectRow = {
  comparison_id: string;
  project_id: string;
  sort_order: number;
};

type ProfileRow = { id: string; full_name: string | null };

function profileName(profiles: ProfileRow[], id: string | null): string | null {
  if (!id) {
    return null;
  }
  return profiles.find((row) => row.id === id)?.full_name?.trim() || null;
}

export async function getSavedComparisonsForCurrentOrganization(): Promise<SavedComparisonsResult> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { kind: "no_organization" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("portfolio_comparisons")
    .select("id, name, created_at, updated_at, created_by")
    .eq("organization_id", organization.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("getSavedComparisonsForCurrentOrganization failed", error.message);
    return { kind: "error", message: "Could not load saved comparisons." };
  }

  const comparisons = (data ?? []) as ComparisonRow[];
  const comparisonIds = comparisons.map((row) => row.id);
  let projectRows: Array<ComparisonProjectRow & { projects?: { archived_at: string | null } | { archived_at: string | null }[] | null }> = [];
  if (comparisonIds.length > 0) {
    const { data: links, error: linkError } = await supabase
      .from("portfolio_comparison_projects")
      .select("comparison_id, project_id, sort_order, projects ( archived_at )")
      .in("comparison_id", comparisonIds);
    if (linkError) {
      console.error("getSavedComparisonsForCurrentOrganization projects failed", linkError.message);
      return { kind: "error", message: "Could not load saved comparisons." };
    }
    projectRows = (links ?? []) as typeof projectRows;
  }

  const creatorIds = [
    ...new Set(comparisons.map((row) => row.created_by).filter((id): id is string => Boolean(id))),
  ];
  let profiles: ProfileRow[] = [];
  if (creatorIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", creatorIds);
    if (profileError) {
      console.error("getSavedComparisonsForCurrentOrganization profiles failed", profileError.message);
    } else {
      profiles = (profileRows ?? []) as ProfileRow[];
    }
  }

  const linksByComparison = new Map<string, typeof projectRows>();
  for (const row of projectRows) {
    const list = linksByComparison.get(row.comparison_id) ?? [];
    list.push(row);
    linksByComparison.set(row.comparison_id, list);
  }

  return {
    kind: "ok",
    canWrite: canWritePortfolioComparisons(organization.role),
    comparisons: comparisons.map((row) => {
      const links = linksByComparison.get(row.id) ?? [];
      const hasArchivedProjects = links.some((link) => {
        const project = Array.isArray(link.projects) ? link.projects[0] : link.projects;
        return Boolean(project?.archived_at);
      });
      return {
        id: row.id,
        name: row.name,
        projectCount: links.length,
        updatedAt: row.updated_at,
        createdAt: row.created_at,
        createdByName: profileName(profiles, row.created_by),
        hasArchivedProjects,
      };
    }),
  };
}

export async function getSavedComparisonById(
  comparisonId: string,
): Promise<SavedComparisonDetailResult> {
  if (!UUID_PATTERN.test(comparisonId)) {
    return { kind: "not_found" };
  }

  const organization = await getCurrentOrganization();
  if (!organization) {
    return { kind: "no_organization" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("portfolio_comparisons")
    .select("id, name, created_at, updated_at, created_by")
    .eq("id", comparisonId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (error) {
    console.error("getSavedComparisonById failed", error.message);
    return { kind: "error", message: "Could not load that comparison." };
  }
  if (!data) {
    return { kind: "not_found" };
  }

  const comparison = data as ComparisonRow;
  const { data: links, error: linkError } = await supabase
    .from("portfolio_comparison_projects")
    .select("comparison_id, project_id, sort_order")
    .eq("comparison_id", comparison.id)
    .order("sort_order", { ascending: true });

  if (linkError) {
    console.error("getSavedComparisonById projects failed", linkError.message);
    return { kind: "error", message: "Could not load that comparison." };
  }

  const projectIds = ((links ?? []) as ComparisonProjectRow[]).map((row) => row.project_id);
  const projectsResult = await getMapProjectsByIds(organization.id, projectIds);
  if (projectsResult.kind !== "ok") {
    return { kind: "error", message: "Could not load that comparison." };
  }

  let createdByName: string | null = null;
  if (comparison.created_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", comparison.created_by)
      .maybeSingle();
    createdByName = profile?.full_name?.trim() || null;
  }

  return {
    kind: "ok",
    comparison: {
      id: comparison.id,
      name: comparison.name,
      updatedAt: comparison.updated_at,
      createdAt: comparison.created_at,
      createdByName,
      canWrite: canWritePortfolioComparisons(organization.role),
      projects: projectsResult.projects,
    },
  };
}
