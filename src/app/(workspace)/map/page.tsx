import { MapPage } from "@/features/map/map-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Map & Compare" };

export default function Page() {
  return <MapPage />;
}
