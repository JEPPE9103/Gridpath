import { getCurrentOrganization } from "@/lib/data/organization";
import { listRecentOpportunitySearches } from "@/lib/data/opportunities";
import { getOpportunitySearchRun, type OpportunityRunCandidate } from "@/lib/data/opportunity-runs";
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

export async function listMapDiscoverySearches(): Promise<MapDiscoverySearch[]> {
  const organization = await getCurrentOrganization();
  if (!organization) return [];
  const recent = await listRecentOpportunitySearches(organization.id);
  return recent.map((item) => ({
    searchId: item.id,
    name: item.name,
    createdAt: item.createdAt,
    latestRunId: item.latestRunId,
    latestRunStatus: item.latestRunStatus,
    returnedCount: item.returnedCount,
    west: item.west,
    south: item.south,
    east: item.east,
    north: item.north,
  }));
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
