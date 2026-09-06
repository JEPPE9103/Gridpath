import { getCurrentOrganization } from "@/lib/data/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { portfolioCapacityMW } from "@/lib/domain/portfolio-capacity";

export type OrganizationProjectAggregates = {
  activeCount: number;
  archivedCount: number;
  allCount: number;
  activeMw: number;
  enquiryCount: number;
  openGridStudyCount: number;
};

const EMPTY: OrganizationProjectAggregates = {
  activeCount: 0,
  archivedCount: 0,
  allCount: 0,
  activeMw: 0,
  enquiryCount: 0,
  openGridStudyCount: 0,
};

type AggregateRow = {
  active_count: number | string | null;
  archived_count: number | string | null;
  all_count: number | string | null;
  active_mw: number | string | null;
  enquiry_count: number | string | null;
  open_grid_study_count: number | string | null;
};

function toCount(value: number | string | null | undefined): number {
  if (value == null || value === "") {
    return 0;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function emptyProjectAggregates(): OrganizationProjectAggregates {
  return { ...EMPTY };
}

export async function getOrganizationProjectAggregates(
  includeArchived = false,
): Promise<{ aggregates: OrganizationProjectAggregates; error: string | null }> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { aggregates: EMPTY, error: null };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_organization_project_aggregates", {
    p_organization_id: organization.id,
    p_include_archived: includeArchived,
  });

  if (error) {
    console.error("getOrganizationProjectAggregates failed", error.message);
    return { aggregates: EMPTY, error: "Could not load portfolio totals." };
  }

  const row = (Array.isArray(data) ? data[0] : data) as AggregateRow | undefined;
  if (!row) {
    return { aggregates: EMPTY, error: null };
  }

  return {
    aggregates: {
      activeCount: toCount(row.active_count),
      archivedCount: toCount(row.archived_count),
      allCount: toCount(row.all_count),
      activeMw: toCount(row.active_mw),
      enquiryCount: toCount(row.enquiry_count),
      openGridStudyCount: toCount(row.open_grid_study_count),
    },
    error: null,
  };
}

export function activeMwFromProjects(projects: Array<{ importMW: number; exportMW: number }>): number {
  return projects.reduce((sum, project) => sum + portfolioCapacityMW(project), 0);
}
