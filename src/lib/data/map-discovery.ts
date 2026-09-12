import { getCurrentOrganization } from "@/lib/data/organization";
import { listRecentOpportunitySearches } from "@/lib/data/opportunities";
import { getOpportunitySearchRun, type OpportunityRunCandidate } from "@/lib/data/opportunity-runs";
import { toNumber } from "@/lib/data/row-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  parseDiscoveryFeatureCollection,
  type MapDiscoverySearch,
  type MapGeoJsonFeatureCollection,
} from "@/lib/domain/map-discovery";

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
  technology: string;
  searchCriteria: {
    maxSlopeDegrees: number | null;
    slopeMode: "preference" | "hard";
    maxRoadDistanceM: number | null;
    roadMode: "preference" | "hard";
    excludeProtected: boolean;
    excludeNatura: boolean;
  };
};

type Bbox = { west: number | null; south: number | null; east: number | null; north: number | null };

function asBbox(row: {
  west?: number | string | null;
  south?: number | string | null;
  east?: number | string | null;
  north?: number | string | null;
}): Bbox {
  return {
    west: row.west == null ? null : toNumber(row.west),
    south: row.south == null ? null : toNumber(row.south),
    east: row.east == null ? null : toNumber(row.east),
    north: row.north == null ? null : toNumber(row.north),
  };
}

export async function listMapDiscoverySearches(): Promise<MapDiscoverySearch[]> {
  const organization = await getCurrentOrganization();
  if (!organization) return [];
  const recent = await listRecentOpportunitySearches(organization.id);
  if (recent.length === 0) return [];
  const runIds = recent.map((item) => item.latestRunId).filter((id): id is string => Boolean(id));
  const searchIds = recent.map((item) => item.id);
  const runBbox = new Map<string, Bbox>();
  const searchBbox = new Map<string, Bbox>();
  const supabase = await createSupabaseServerClient();
  if (runIds.length > 0) {
    const { data: runs, error: runError } = await supabase
      .from("opportunity_search_runs")
      .select("id, west, south, east, north")
      .eq("organization_id", organization.id)
      .in("id", runIds);
    if (runError) {
      console.error("listMapDiscoverySearches run bbox failed", runError.message);
    } else {
      for (const run of runs ?? []) {
        runBbox.set(run.id, asBbox(run));
      }
    }
  }
  const { data: searches, error: searchError } = await supabase
    .from("opportunity_searches")
    .select("id, west, south, east, north")
    .eq("organization_id", organization.id)
    .in("id", searchIds);
  if (searchError) {
    console.error("listMapDiscoverySearches search bbox failed", searchError.message);
  } else {
    for (const search of searches ?? []) {
      searchBbox.set(search.id, asBbox(search));
    }
  }
  return recent.map((item) => {
    const bbox = (item.latestRunId ? runBbox.get(item.latestRunId) : undefined) ?? searchBbox.get(item.id);
    return {
      searchId: item.id,
      name: item.name,
      createdAt: item.createdAt,
      latestRunId: item.latestRunId,
      latestRunStatus: item.latestRunStatus,
      returnedCount: item.returnedCount,
      west: bbox?.west ?? null,
      south: bbox?.south ?? null,
      east: bbox?.east ?? null,
      north: bbox?.north ?? null,
    };
  });
}

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
    technology: view.technology,
    geojson: parseDiscoveryFeatureCollection(view.geojson),
    providerAvailability: view.providerAvailability,
    searchCriteria: view.searchCriteria,
  };
}
