import { cache } from "react";
import { getCurrentOrganization } from "@/lib/data/organization";
import { getOpportunitySearchRun, type OpportunityRunCandidate } from "@/lib/data/opportunity-runs";
import { toNumber } from "@/lib/data/row-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  parseDiscoveryFeatureCollection,
  type MapDiscoverySearch,
  type MapGeoJsonFeatureCollection,
} from "@/lib/domain/map-discovery";

const MAP_SEARCH_LIMIT = 8;

export type MapDiscoveryRunPayload = {
  searchId: string;
  runId: string;
  searchName: string;
  status: string;
  west: number | null;
  south: number | null;
  east: number | null;
  north: number | null;
  candidateCount: number;
  candidates: OpportunityRunCandidate[];
  geojson: MapGeoJsonFeatureCollection;
  providerAvailability: Record<string, boolean>;
};

type SearchRow = {
  id: string;
  name: string | null;
  created_at: string;
  latest_run_id: string | null;
};

type RunRow = {
  id: string;
  search_id: string;
  status: string;
  returned_count: number | string | null;
  west: number | string | null;
  south: number | string | null;
  east: number | string | null;
  north: number | string | null;
  completed_at: string | null;
  started_at: string | null;
};

export const listMapDiscoverySearches = cache(async (): Promise<MapDiscoverySearch[]> => {
  const organization = await getCurrentOrganization();
  if (!organization) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("opportunity_searches")
    .select("id, name, created_at, latest_run_id")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(MAP_SEARCH_LIMIT);
  if (error) {
    console.error("listMapDiscoverySearches failed", error.message);
    return [];
  }
  const rows = (data ?? []) as SearchRow[];
  if (rows.length === 0) return [];
  const searchIds = rows.map((row) => row.id);
  const { data: runs, error: runError } = await supabase
    .from("opportunity_search_runs")
    .select("id, search_id, status, returned_count, west, south, east, north, completed_at, started_at")
    .eq("organization_id", organization.id)
    .in("search_id", searchIds)
    .order("started_at", { ascending: false });
  if (runError) {
    console.error("listMapDiscoverySearches runs failed", runError.message);
  }
  const latestBySearch = new Map<string, RunRow>();
  for (const run of (runs ?? []) as RunRow[]) {
    if (!latestBySearch.has(run.search_id)) latestBySearch.set(run.search_id, run);
  }
  return rows.map((row) => {
    const preferred = row.latest_run_id
      ? ((runs ?? []) as RunRow[]).find((run) => run.id === row.latest_run_id)
      : undefined;
    const run = preferred ?? latestBySearch.get(row.id);
    return {
      searchId: row.id,
      name: row.name?.trim() || "Untitled search",
      createdAt: run?.completed_at || run?.started_at || row.created_at,
      latestRunId: run?.id ?? row.latest_run_id,
      latestRunStatus: run?.status ?? null,
      returnedCount: run?.returned_count == null ? null : toNumber(run.returned_count),
      west: run?.west == null ? null : toNumber(run.west),
      south: run?.south == null ? null : toNumber(run.south),
      east: run?.east == null ? null : toNumber(run.east),
      north: run?.north == null ? null : toNumber(run.north),
    };
  });
});

export async function getMapDiscoveryRun(
  searchId: string,
  runId: string,
): Promise<MapDiscoveryRunPayload | null> {
  const view = await getOpportunitySearchRun(searchId, runId);
  if (!view || view.kind !== "ok") return null;
  return {
    searchId: view.searchId,
    runId: view.runId,
    searchName: view.searchName,
    status: view.status,
    west: view.west,
    south: view.south,
    east: view.east,
    north: view.north,
    candidateCount: view.candidates.length,
    candidates: view.candidates,
    geojson: parseDiscoveryFeatureCollection(view.geojson),
    providerAvailability: view.providerAvailability,
  };
}
