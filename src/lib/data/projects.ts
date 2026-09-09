import { applyArchiveFilter } from "@/lib/data/archive-filter";
import { getCurrentOrganization } from "@/lib/data/organization";
import { PORTFOLIO_PAGE_SIZE, fetchAllQueryPages } from "@/lib/data/paged-select";
import {
  confidenceLabel,
  outlookLabel,
  outlookToDb,
  pipelineStageLabel,
  pipelineStageToDb,
  technologyLabel,
  technologyToDb,
} from "@/lib/domain/catalog-labels";
import type { PortfolioAttentionFilter } from "@/lib/intelligence/portfolio-attention";
import { parseArchiveView, type ArchiveView } from "@/lib/projects/archive-scope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Outlook, PipelineStage, ProjectListItem, Technology } from "@/types";
import { asSingle, parsePoint, toNumber } from "@/lib/data/row-utils";

type GridOperatorRow = { name: string };

type ProjectSiteRow = {
  name: string | null;
  location: string | null;
  geom: unknown;
  is_primary: boolean;
};

type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  location: string | null;
  technology: string | null;
  import_mw: number | string | null;
  export_mw: number | string | null;
  voltage_level: string | null;
  connection_stage: string;
  connection_outlook: string;
  confidence: string;
  target_cod: string | null;
  updated_at: string;
  archived_at: string | null;
  grid_operators: GridOperatorRow | GridOperatorRow[] | null;
  project_sites: ProjectSiteRow[] | null;
};

export type PortfolioSortKey =
  | "name"
  | "location"
  | "technology"
  | "capacity"
  | "gridOperator"
  | "stage"
  | "outlook"
  | "targetCOD"
  | "lastUpdated"
  | "attention";

export type ListProjectsQuery = {
  view?: string | null;
  q?: string | null;
  technology?: string | null;
  operator?: string | null;
  stage?: string | null;
  outlook?: string | null;
  page?: string | null;
  sort?: string | null;
  dir?: string | null;
  attention?: string | null;
  unpaged?: boolean;
};

export type ListProjectsResult = {
  projects: ProjectListItem[];
  blockedByRls: boolean;
  error: string | null;
  view: ArchiveView;
  page: number;
  pageSize: number;
  matchingCount: number;
  operators: string[];
  query: string;
  technology: Technology | "All";
  operator: string;
  stage: PipelineStage | "All";
  outlook: Outlook | "All";
  sortKey: PortfolioSortKey;
  sortDir: "asc" | "desc";
  attentionFilter: PortfolioAttentionFilter;
};

const PROJECT_SELECT = `
  id,
  slug,
  name,
  location,
  technology,
  import_mw,
  export_mw,
  voltage_level,
  connection_stage,
  connection_outlook,
  confidence,
  target_cod,
  updated_at,
  archived_at,
  grid_operators ( name ),
  project_sites!inner ( name, location, geom, is_primary )
`;

function pickPrimarySite(sites: ProjectSiteRow[] | null): ProjectSiteRow | null {
  if (!sites?.length) {
    return null;
  }
  return sites.find((site) => site.is_primary) ?? sites[0] ?? null;
}

function mapProject(row: ProjectRow): ProjectListItem {
  const operator = asSingle(row.grid_operators);
  const site = pickPrimarySite(row.project_sites);
  const point = parsePoint(site?.geom);

  return {
    id: row.slug || row.id,
    projectId: row.id,
    name: row.name,
    location: row.location || site?.location || site?.name || "",
    latitude: point?.latitude ?? 0,
    longitude: point?.longitude ?? 0,
    technology: technologyLabel(row.technology),
    importMW: toNumber(row.import_mw),
    exportMW: toNumber(row.export_mw),
    gridOperator: operator?.name ?? "",
    voltageLevel: row.voltage_level ?? "",
    stage: pipelineStageLabel(row.connection_stage),
    outlook: outlookLabel(row.connection_outlook),
    confidence: confidenceLabel(row.confidence),
    targetCOD: row.target_cod ?? "",
    lastUpdated: row.updated_at,
    archivedAt: row.archived_at,
  };
}

function parsePage(value: string | null | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function parseSortKey(value: string | null | undefined): PortfolioSortKey {
  const allowed: PortfolioSortKey[] = [
    "name",
    "location",
    "technology",
    "capacity",
    "gridOperator",
    "stage",
    "outlook",
    "targetCOD",
    "lastUpdated",
    "attention",
  ];
  return allowed.includes(value as PortfolioSortKey) ? (value as PortfolioSortKey) : "lastUpdated";
}

function parseSortDir(value: string | null | undefined, sortKey: PortfolioSortKey): "asc" | "desc" {
  if (value === "asc" || value === "desc") {
    return value;
  }
  return sortKey === "name" || sortKey === "location" ? "asc" : "desc";
}

function orderColumn(sortKey: PortfolioSortKey): { column: string; foreignTable?: string } {
  switch (sortKey) {
    case "name":
      return { column: "name" };
    case "location":
      return { column: "location" };
    case "technology":
      return { column: "technology" };
    case "capacity":
      return { column: "export_mw" };
    case "gridOperator":
      return { column: "name", foreignTable: "grid_operators" };
    case "stage":
      return { column: "connection_stage" };
    case "outlook":
      return { column: "connection_outlook" };
    case "targetCOD":
      return { column: "target_cod" };
    default:
      return { column: "updated_at" };
  }
}

function parseAttentionFilter(value: string | null | undefined): PortfolioAttentionFilter {
  if (value === "action" || value === "needs_attention" || value === "official_changes") {
    return value;
  }
  return "all";
}

function sanitizeSearch(value: string): string {
  return value.replace(/[%_,()]/g, " ").trim();
}

export async function listProjects(query: ListProjectsQuery = {}): Promise<ListProjectsResult> {
  const view = parseArchiveView(query.view);
  const search = (query.q ?? "").trim();
  const technologyFilter = (query.technology as Technology | "All" | undefined) ?? "All";
  const operatorFilter = query.operator?.trim() || "All";
  const stageFilter = (query.stage as PipelineStage | "All" | undefined) ?? "All";
  const outlookFilter = (query.outlook as Outlook | "All" | undefined) ?? "All";
  const sortKey = parseSortKey(query.sort);
  const sortDir = parseSortDir(query.dir, sortKey);
  const page = parsePage(query.page);
  const attentionFilter = parseAttentionFilter(query.attention);
  const unpaged = Boolean(query.unpaged) || sortKey === "attention" || attentionFilter !== "all";
  const empty: ListProjectsResult = {
    projects: [],
    blockedByRls: false,
    error: null,
    view,
    page,
    pageSize: PORTFOLIO_PAGE_SIZE,
    matchingCount: 0,
    operators: [],
    query: search,
    technology: technologyFilter,
    operator: operatorFilter,
    stage: stageFilter,
    outlook: outlookFilter,
    sortKey,
    sortDir,
    attentionFilter,
  };

  const organization = await getCurrentOrganization();
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!organization) {
    return { ...empty, blockedByRls: !user };
  }

  const organizationId = organization.id;

  const technologyDb =
    technologyFilter !== "All" ? technologyToDb(technologyFilter) ?? technologyFilter : null;
  const stageDb = stageFilter !== "All" ? pipelineStageToDb(stageFilter) ?? null : null;
  const outlookDb = outlookFilter !== "All" ? outlookToDb(outlookFilter) ?? null : null;

type FilterableQuery = {
  eq: (column: string, value: string | boolean) => FilterableQuery;
  is: (column: string, value: null) => FilterableQuery;
  not: (column: string, operator: string, value: null) => FilterableQuery;
  or: (filters: string) => FilterableQuery;
  order: (
    column: string,
    options?: { ascending?: boolean; foreignTable?: string; nullsFirst?: boolean },
  ) => FilterableQuery;
  range: (
    from: number,
    to: number,
  ) => Promise<{
    data: unknown;
    error: { message: string } | null;
    count: number | null;
  }>;
};

function applyFilters(builder: FilterableQuery): FilterableQuery {
    let next = applyArchiveFilter(builder, view);
    next = next.eq("organization_id", organizationId);
    next = next.eq("project_sites.is_primary", true);
    if (technologyDb) {
      next = next.eq("technology", technologyDb);
    }
    if (stageDb) {
      next = next.eq("connection_stage", stageDb);
    }
    if (outlookDb) {
      next = next.eq("connection_outlook", outlookDb);
    }
    if (operatorFilter !== "All") {
      next = next.eq("grid_operators.name", operatorFilter);
    }
    const needle = sanitizeSearch(search);
    if (needle) {
      next = next.or(`name.ilike.%${needle}%,location.ilike.%${needle}%`);
    }
    return next;
  }

  const order = orderColumn(sortKey);
  const from = (page - 1) * PORTFOLIO_PAGE_SIZE;
  const to = from + PORTFOLIO_PAGE_SIZE - 1;

  const countBuilder = applyFilters(
    supabase.from("projects").select("id, project_sites!inner(is_primary)", {
      count: "exact",
      head: true,
    }) as unknown as FilterableQuery,
  );
  const pageBuilder = applyFilters(
    supabase.from("projects").select(PROJECT_SELECT) as unknown as FilterableQuery,
  );
  const ordered =
    order.foreignTable != null
      ? pageBuilder.order(order.column, {
          ascending: sortDir === "asc",
          foreignTable: order.foreignTable,
          nullsFirst: false,
        })
      : pageBuilder.order(order.column, { ascending: sortDir === "asc", nullsFirst: false });

  const operatorPromise = fetchAllQueryPages<{
    grid_operators: GridOperatorRow | GridOperatorRow[] | null;
  }>(async (opFrom, opTo) => {
    const builder = applyArchiveFilter(
      supabase
        .from("projects")
        .select("grid_operators ( name ), project_sites!inner(is_primary)")
        .eq("organization_id", organizationId)
        .eq("project_sites.is_primary", true),
      view,
    );
    const result = await builder.range(opFrom, opTo);
    return {
      data: (result.data ?? null) as Array<{
        grid_operators: GridOperatorRow | GridOperatorRow[] | null;
      }> | null,
      error: result.error,
    };
  });

type CountResult = { count: number | null; error: { message: string } | null };

  const pagePromise = unpaged
    ? fetchAllQueryPages<ProjectRow>(async (pageFrom, pageTo) => {
        const result = await ordered.range(pageFrom, pageTo);
        return {
          data: (result.data ?? null) as ProjectRow[] | null,
          error: result.error,
        };
      })
    : ordered.range(from, to);

  const [countResult, pageResult, operatorResult] = await Promise.all([
    countBuilder as unknown as PromiseLike<CountResult>,
    pagePromise,
    operatorPromise,
  ]);

  const pagedError = unpaged
    ? (pageResult as { error: string | null }).error
    : (pageResult as { error: { message: string } | null }).error?.message ?? null;
  if (countResult.error || pagedError || operatorResult.error) {
    console.error("listProjects failed", {
      count: countResult.error?.message,
      page: pagedError,
      operators: operatorResult.error,
    });
    return {
      ...empty,
      blockedByRls: !user,
      error: "Could not load projects. Try again in a moment.",
    };
  }

  const rows = unpaged
    ? (pageResult as { rows: ProjectRow[] }).rows
    : (((pageResult as { data?: ProjectRow[] }).data ?? []) as ProjectRow[]);
  if (!user && rows.length === 0 && (countResult.count ?? 0) === 0) {
    return { ...empty, blockedByRls: true };
  }

  const operators = [
    ...new Set(
      operatorResult.rows
        .map((row) => asSingle(row.grid_operators)?.name)
        .filter((name): name is string => Boolean(name)),
    ),
  ].sort((a, b) => a.localeCompare(b, "sv"));

  return {
    ...empty,
    projects: rows.map(mapProject),
    blockedByRls: false,
    error: null,
    matchingCount: countResult.count ?? 0,
    operators,
  };
}

export async function listAllProjectsForOrganization(
  view: ArchiveView = "active",
): Promise<{ projects: ProjectListItem[]; error: string | null }> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { projects: [], error: null };
  }

  const supabase = await createSupabaseServerClient();
  const result = await fetchAllQueryPages<ProjectRow>(async (from, to) => {
    let query = supabase
      .from("projects")
      .select(PROJECT_SELECT)
      .eq("organization_id", organization.id)
      .eq("project_sites.is_primary", true)
      .order("updated_at", { ascending: false });
    query = applyArchiveFilter(query, view);
    const page = await query.range(from, to);
    return { data: (page.data ?? null) as ProjectRow[] | null, error: page.error };
  });

  if (result.error) {
    console.error("listAllProjectsForOrganization failed", result.error);
    return { projects: [], error: "Could not load projects." };
  }

  return { projects: result.rows.map(mapProject), error: null };
}

export type ProjectDuplicateKey = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
};

export async function listProjectDuplicateKeys(): Promise<{
  keys: ProjectDuplicateKey[];
  error: string | null;
}> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { keys: [], error: null };
  }

  type KeyRow = {
    id: string;
    name: string;
    project_sites: ProjectSiteRow[] | null;
  };

  const supabase = await createSupabaseServerClient();
  const result = await fetchAllQueryPages<KeyRow>(async (from, to) => {
    const page = await supabase
      .from("projects")
      .select("id, name, project_sites!inner ( geom, is_primary )")
      .eq("organization_id", organization.id)
      .eq("project_sites.is_primary", true)
      .order("id", { ascending: true })
      .range(from, to);
    return { data: (page.data ?? null) as KeyRow[] | null, error: page.error };
  });

  if (result.error) {
    console.error("listProjectDuplicateKeys failed", result.error);
    return { keys: [], error: result.error };
  }

  return {
    keys: result.rows.map((row) => {
      const site = pickPrimarySite(row.project_sites);
      const point = parsePoint(site?.geom);
      return {
        id: row.id,
        name: row.name,
        latitude: point?.latitude ?? null,
        longitude: point?.longitude ?? null,
      };
    }),
    error: null,
  };
}
