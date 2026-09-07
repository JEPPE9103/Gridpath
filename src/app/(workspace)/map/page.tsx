import { getMapProjectsForCurrentOrganization } from "@/lib/data/map-projects";
import { getOfficialMapLayerGeojson, getOrganizationOfficialSpatialMatches } from "@/lib/data/official-map";
import { getSavedComparisonsForCurrentOrganization } from "@/lib/data/portfolio-comparisons";
import { SWEDEN_MAP_BOUNDS } from "@/lib/domain/official-map";
import { MapPage } from "@/features/map/map-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Map & Compare" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const [result, savedComparisons, localNetwork, planningArea, spatialMatches] = await Promise.all([
    getMapProjectsForCurrentOrganization(),
    getSavedComparisonsForCurrentOrganization(),
    getOfficialMapLayerGeojson("local_network", SWEDEN_MAP_BOUNDS, 4.35),
    getOfficialMapLayerGeojson("planning_area", SWEDEN_MAP_BOUNDS, 4.35),
    getOrganizationOfficialSpatialMatches(),
  ]);
  return (
    <MapPage
      result={result}
      savedComparisons={savedComparisons}
      localNetwork={localNetwork}
      planningArea={planningArea}
      spatialMatches={spatialMatches}
      initialProjectSlug={params.project ?? null}
    />
  );
}
