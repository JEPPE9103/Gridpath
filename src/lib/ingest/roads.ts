import { createHash } from "node:crypto";
import { ROADLINK_SOURCE_SLUG } from "@/lib/ingest/coverage-keys";
import { fetchOpenGeodataText } from "@/lib/ingest/open-geodata";
import type { SearchBbox } from "@/lib/opportunities/spatial-screening";

export const TRAFIKVERKET_ROADLINK_WFS =
  "https://geo-inspire.trafikverket.se/MapService/wfs.axd/TN_RoadTransportNetwork";
export const TRAFIKVERKET_ROADLINK_TYPE = "RoadLink";

export type RoadFeatureRow = {
  id: string;
  name: string | null;
  cls: string | null;
  geom: Record<string, unknown>;
};

function looksLatLon(pair: unknown): boolean {
  return (
    Array.isArray(pair) &&
    pair.length >= 2 &&
    typeof pair[0] === "number" &&
    typeof pair[1] === "number" &&
    pair[0] > 40 &&
    pair[0] < 80 &&
    pair[1] > 0 &&
    pair[1] < 40
  );
}

function swapLatLonCoords(coords: unknown): unknown {
  if (!Array.isArray(coords) || coords.length === 0) return coords;
  if (typeof coords[0] === "number") {
    return looksLatLon(coords) ? [coords[1], coords[0], ...coords.slice(2)] : coords;
  }
  return coords.map(swapLatLonCoords);
}

export function normalizeRoadGeometry(geom: { type?: string; coordinates?: unknown } | null): Record<string, unknown> | null {
  if (!geom || (geom.type !== "LineString" && geom.type !== "MultiLineString")) return null;
  return { ...geom, coordinates: swapLatLonCoords(geom.coordinates) };
}

export function buildRoadLinkWfsUrl(bbox: SearchBbox, axis: "latlon" | "lonlat" = "latlon"): string {
  const url = new URL(TRAFIKVERKET_ROADLINK_WFS);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("typeNames", TRAFIKVERKET_ROADLINK_TYPE);
  url.searchParams.set("outputFormat", "application/json");
  url.searchParams.set("srsName", "EPSG:4326");
  url.searchParams.set("count", "5000");
  if (axis === "latlon") {
    url.searchParams.set("bbox", `${bbox.south},${bbox.west},${bbox.north},${bbox.east},EPSG:4326`);
  } else {
    url.searchParams.set("bbox", `${bbox.west},${bbox.south},${bbox.east},${bbox.north},EPSG:4326`);
  }
  return url.href;
}

function splitBbox(area: SearchBbox): SearchBbox[] {
  const midX = (area.west + area.east) / 2;
  const midY = (area.south + area.north) / 2;
  return [
    { west: area.west, south: area.south, east: midX, north: midY },
    { west: midX, south: area.south, east: area.east, north: midY },
    { west: area.west, south: midY, east: midX, north: area.north },
    { west: midX, south: midY, east: area.east, north: area.north },
  ];
}

function parseFeatures(text: string): Array<{ id?: string; properties?: Record<string, unknown>; geometry?: { type?: string; coordinates?: unknown } }> {
  if (text.includes("ExceptionReport") || text.includes("ows:Exception")) {
    throw new Error(`Trafikverket WFS ExceptionReport: ${text.slice(0, 240)}`);
  }
  const parsed = JSON.parse(text) as { features?: unknown };
  return Array.isArray(parsed.features) ? (parsed.features as never) : [];
}

async function fetchRoadPage(bbox: SearchBbox, axis: "latlon" | "lonlat"): Promise<ReturnType<typeof parseFeatures>> {
  const text = await fetchOpenGeodataText(buildRoadLinkWfsUrl(bbox, axis), 90_000);
  return parseFeatures(text);
}

async function collectRoadFeatures(
  area: SearchBbox,
  axis: "latlon" | "lonlat",
  depth: number,
  seen: Set<string>,
  acc: RoadFeatureRow[],
): Promise<void> {
  const page = await fetchRoadPage(area, axis);
  if (page.length >= 5000 && depth < 5) {
    for (const child of splitBbox(area)) {
      await collectRoadFeatures(child, axis, depth + 1, seen, acc);
    }
    return;
  }
  for (const feature of page) {
    const props = feature.properties ?? {};
    const id = String(
      feature.id ??
        props.localId ??
        props.inspireId ??
        props.name ??
        (Array.isArray(feature.geometry?.coordinates) ? JSON.stringify(feature.geometry.coordinates[0]) : acc.length),
    );
    if (seen.has(id)) continue;
    seen.add(id);
    const geom = normalizeRoadGeometry(feature.geometry ?? null);
    if (!geom) continue;
    acc.push({
      id: id.slice(0, 200),
      name: typeof props.nationalRoadNumber === "string" ? props.nationalRoadNumber : null,
      cls: typeof props.functionalRoadClass === "string" || typeof props.functionalRoadClass === "number"
        ? String(props.functionalRoadClass)
        : typeof props.roadForm === "string"
          ? props.roadForm
          : null,
      geom,
    });
  }
}

export async function fetchRoadLinkFeatures(bbox: SearchBbox): Promise<RoadFeatureRow[]> {
  const features: RoadFeatureRow[] = [];
  const seen = new Set<string>();
  try {
    await collectRoadFeatures(bbox, "latlon", 0, seen, features);
  } catch {
    // Try lon,lat axis if the service rejects lat,lon.
  }
  if (features.length === 0) {
    await collectRoadFeatures(bbox, "lonlat", 0, seen, features);
  }
  if (features.length === 0) {
    throw new Error("Trafikverket RoadLink WFS returned 0 features for the requested bbox.");
  }
  return features;
}

export function roadlinkSnapshotHash(bbox: SearchBbox, count: number): string {
  return createHash("sha256")
    .update(`${ROADLINK_SOURCE_SLUG}|${count}|${bbox.west}|${bbox.south}|${bbox.east}|${bbox.north}`)
    .digest("hex");
}
