import { listOpportunitiesForCurrentOrganization } from "@/lib/data/opportunities";
import { getOfficialChangeMapTarget } from "@/lib/data/grid-changes";
import { getMapProjectsForCurrentOrganization } from "@/lib/data/map-projects";
import { getOfficialMapLayerGeojson, getOrganizationOfficialSpatialMatches } from "@/lib/data/official-map";
import { getSavedComparisonsForCurrentOrganization } from "@/lib/data/portfolio-comparisons";
import { SWEDEN_MAP_BOUNDS } from "@/lib/domain/official-map";
import { MapPage } from "@/features/map/map-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Map" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; change?: string }>;
}) {
  const params = await searchParams;
  const [result, savedComparisons, localNetwork, planningArea, spatialMatches, changeTarget, opportunities] =
    await Promise.all([
      getMapProjectsForCurrentOrganization(),
      getSavedComparisonsForCurrentOrganization(),
      getOfficialMapLayerGeojson("local_network", SWEDEN_MAP_BOUNDS, 4.35),
      getOfficialMapLayerGeojson("planning_area", SWEDEN_MAP_BOUNDS, 4.35),
      getOrganizationOfficialSpatialMatches(),
      params.change ? getOfficialChangeMapTarget(params.change) : Promise.resolve(null),
      listOpportunitiesForCurrentOrganization(),
    ]);
  return (
    <MapPage
      result={result}
      opportunities={opportunities.items}
      savedComparisons={savedComparisons}
      localNetwork={localNetwork}
      planningArea={planningArea}
      spatialMatches={spatialMatches}
      initialProjectSlug={params.project ?? changeTarget?.projectSlug ?? null}
      initialChangeArea={
        changeTarget?.areaId
          ? { areaId: changeTarget.areaId, layer: changeTarget.layer }
          : null
      }
    />
  );
}
