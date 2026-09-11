import { listMapDiscoverySearches } from "@/lib/data/map-discovery";
import { listOpportunitiesForCurrentOrganization } from "@/lib/data/opportunities";
import { getOfficialChangeMapTarget } from "@/lib/data/grid-changes";
import { getMapProjectsForCurrentOrganization } from "@/lib/data/map-projects";
import {
  getOfficialMapLayerLoad,
  getOrganizationOfficialSpatialMatchesLoad,
} from "@/lib/data/official-map";
import { getSavedComparisonsForCurrentOrganization } from "@/lib/data/portfolio-comparisons";
import { SWEDEN_MAP_BOUNDS } from "@/lib/domain/official-map";
import { MapPage } from "@/features/map/map-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Map" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; change?: string; run?: string }>;
}) {
  const params = await searchParams;
  const [result, savedComparisons, localNetwork, planningArea, spatialMatches, changeTarget, opportunities, discoverySearches] =
    await Promise.all([
      getMapProjectsForCurrentOrganization(),
      getSavedComparisonsForCurrentOrganization(),
      getOfficialMapLayerLoad("local_network", SWEDEN_MAP_BOUNDS, 4.35),
      getOfficialMapLayerLoad("planning_area", SWEDEN_MAP_BOUNDS, 4.35),
      getOrganizationOfficialSpatialMatchesLoad(),
      params.change ? getOfficialChangeMapTarget(params.change) : Promise.resolve(null),
      listOpportunitiesForCurrentOrganization(),
      listMapDiscoverySearches(),
    ]);
  return (
    <MapPage
      result={result}
      opportunities={opportunities.items}
      discoverySearches={discoverySearches}
      savedComparisons={savedComparisons}
      localNetwork={localNetwork.collection}
      planningArea={planningArea.collection}
      spatialMatches={spatialMatches.matches}
      officialStatus={{
        localNetwork: localNetwork.status,
        planningArea: planningArea.status,
        matches: spatialMatches.status,
      }}
      initialProjectSlug={params.project ?? changeTarget?.projectSlug ?? null}
      initialChangeArea={
        changeTarget?.areaId
          ? { areaId: changeTarget.areaId, layer: changeTarget.layer }
          : null
      }
      initialRunId={params.run ?? null}
    />
  );
}
