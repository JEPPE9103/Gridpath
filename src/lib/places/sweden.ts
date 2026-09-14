import {
  SWEDEN_EAST,
  SWEDEN_NORTH,
  SWEDEN_SOUTH,
  SWEDEN_WEST,
  type SearchBbox,
} from "@/lib/opportunities/spatial-screening";

export type SwedenPlaceKind = "municipality" | "county" | "place" | "address";

export type SwedenPlaceResult = {
  id: string;
  label: string;
  kind: SwedenPlaceKind;
  bbox: SearchBbox;
  latitude: number;
  longitude: number;
  municipality: string;
  region: string;
  cartographicBoundary: boolean;
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_USER_AGENT = "NOXHEIM/1.0 (+https://www.noxheim.com; sweden-place-search)";

function clipSweden(bbox: SearchBbox): SearchBbox | null {
  const west = Math.max(bbox.west, SWEDEN_WEST);
  const south = Math.max(bbox.south, SWEDEN_SOUTH);
  const east = Math.min(bbox.east, SWEDEN_EAST);
  const north = Math.min(bbox.north, SWEDEN_NORTH);
  if (west >= east || south >= north) return null;
  return { west, south, east, north };
}

function usefulZoomBbox(bbox: SearchBbox): SearchBbox {
  const minSpan = 0.08;
  const width = bbox.east - bbox.west;
  const height = bbox.north - bbox.south;
  const padX = width < minSpan ? (minSpan - width) / 2 : 0;
  const padY = height < minSpan ? (minSpan - height) / 2 : 0;
  return (
    clipSweden({
      west: bbox.west - padX,
      south: bbox.south - padY,
      east: bbox.east + padX,
      north: bbox.north + padY,
    }) ?? bbox
  );
}

export function isSwedenPlaceQuery(query: string): boolean {
  return query.trim().length >= 2;
}

export function parseAdministrativePlaces(rows: unknown): SwedenPlaceResult[] {
  if (!Array.isArray(rows)) return [];
  const out: SwedenPlaceResult[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const west = Number(item.west);
    const south = Number(item.south);
    const east = Number(item.east);
    const north = Number(item.north);
    const clipped = clipSweden({ west, south, east, north });
    if (!clipped) continue;
    const kind: SwedenPlaceKind = item.area_class === "county" ? "county" : "municipality";
    const name = String(item.name ?? "").trim();
    if (!name) continue;
    out.push({
      id: `scb:${kind}:${String(item.code ?? name)}`,
      label: kind === "county" ? `${name} (county)` : `${name} (municipality)`,
      kind,
      bbox: usefulZoomBbox(clipped),
      latitude: (clipped.south + clipped.north) / 2,
      longitude: (clipped.west + clipped.east) / 2,
      municipality: kind === "municipality" ? name : "",
      region: kind === "county" ? name : "",
      cartographicBoundary: true,
    });
  }
  return out;
}

type NominatimHit = {
  display_name?: string;
  lat?: string;
  lon?: string;
  boundingbox?: string[];
  class?: string;
  type?: string;
  address?: { city?: string; town?: string; village?: string; municipality?: string; county?: string; country?: string };
};

export function parseNominatimSwedenHits(hits: unknown): SwedenPlaceResult[] {
  if (!Array.isArray(hits)) return [];
  const out: SwedenPlaceResult[] = [];
  for (const hit of hits as NominatimHit[]) {
    const lat = Number(hit.lat);
    const lon = Number(hit.lon);
    const box = hit.boundingbox ?? [];
    const south = Number(box[0] ?? lat - 0.04);
    const north = Number(box[1] ?? lat + 0.04);
    const west = Number(box[2] ?? lon - 0.06);
    const east = Number(box[3] ?? lon + 0.06);
    const clipped = clipSweden({ west, south, east, north });
    if (!clipped || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const country = String(hit.address?.country ?? hit.display_name ?? "");
    if (!/sweden|sverige/i.test(country)) continue;
    if (lon < SWEDEN_WEST || lon > SWEDEN_EAST || lat < SWEDEN_SOUTH || lat > SWEDEN_NORTH) continue;
    const kind: SwedenPlaceKind =
      hit.type === "administrative" && hit.class === "boundary"
        ? "municipality"
        : hit.class === "place"
          ? "place"
          : "address";
    const label = String(hit.display_name ?? "").split(",")[0]?.trim() || "Place";
    out.push({
      id: `nominatim:${hit.lat}:${hit.lon}`,
      label,
      kind,
      bbox: usefulZoomBbox(clipped),
      latitude: lat,
      longitude: lon,
      municipality: hit.address?.municipality || hit.address?.city || hit.address?.town || "",
      region: hit.address?.county || "",
      cartographicBoundary: false,
    });
  }
  return out;
}

export async function fetchNominatimSwedenPlaces(query: string): Promise<SwedenPlaceResult[]> {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "se");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("q", query.trim());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": NOMINATIM_USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) return [];
    return parseNominatimSwedenHits(await response.json());
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function placeDedupeKey(item: SwedenPlaceResult): string {
  const base = item.label
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
  return base;
}

export function mergeSwedenPlaceResults(
  administrative: SwedenPlaceResult[],
  nominatim: SwedenPlaceResult[],
): SwedenPlaceResult[] {
  const seen = new Set<string>();
  const out: SwedenPlaceResult[] = [];
  for (const item of [...administrative, ...nominatim]) {
    const key = placeDedupeKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= 8) break;
  }
  return out;
}
