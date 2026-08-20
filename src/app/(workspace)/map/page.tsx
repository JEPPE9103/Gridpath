import { getMapProjectsForCurrentOrganization } from "@/lib/data/map-projects";
import { MapPage } from "@/features/map/map-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Map & Compare" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const result = await getMapProjectsForCurrentOrganization();
  return <MapPage result={result} />;
}
