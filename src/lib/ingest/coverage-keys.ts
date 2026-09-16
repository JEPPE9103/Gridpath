import type { SearchBbox } from "@/lib/opportunities/spatial-screening";

export const NMD_SOURCE_SLUG = "nv-nmd-2023";
export const COPERNICUS_SOURCE_SLUG = "copernicus-dem-glo90";
export const ROADLINK_SOURCE_SLUG = "trafikverket-inspire-roadlink";
export const FLOOD_SOURCE_SLUG = "msb-oversvamningskartering";
export const GROUND_SOURCE_SLUG = "sgu-jordarter-25k-100k";
export const DTM_SOURCE_SLUG = "lantmateriet-dtm-1m";

export const NMD_WINDOW_STEP_DEG = 0.2;
export const ROADLINK_WINDOW_STEP_DEG = 0.25;
export const FLOOD_WINDOW_STEP_DEG = 0.2;
export const GROUND_WINDOW_STEP_DEG = 0.2;
/** Small windows so 1 m DTM tiles stay candidate/AOI scoped — not national. */
export const DTM_WINDOW_STEP_DEG = 0.05;

export type CoverageStatus = "covered" | "partial" | "missing" | "stale";
export type IngestWindowOutcome = "acquired" | "covered" | "waiting";

export type CoverageWindow = {
  sourceSlug: string;
  coverageKey: string;
  bbox: SearchBbox;
};

export function quantizeFloor(value: number, step: number): number {
  return Math.floor(value / step) * step;
}

export function quantizeCeil(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

export function tilesForBbox(bbox: SearchBbox, step: number): SearchBbox[] {
  const west0 = quantizeFloor(bbox.west, step);
  const south0 = quantizeFloor(bbox.south, step);
  const east0 = quantizeCeil(bbox.east, step);
  const north0 = quantizeCeil(bbox.north, step);
  const tiles: SearchBbox[] = [];
  for (let south = south0; south < north0 - step / 4; south = Number((south + step).toFixed(8))) {
    for (let west = west0; west < east0 - step / 4; west = Number((west + step).toFixed(8))) {
      tiles.push({
        west,
        south,
        east: Number((west + step).toFixed(8)),
        north: Number((south + step).toFixed(8)),
      });
    }
  }
  return tiles.length > 0 ? tiles : [{ west: west0, south: south0, east: east0, north: north0 }];
}

export function copernicusTileName(lat: number, lon: number): string {
  const n = String(Math.abs(lat)).padStart(2, "0");
  const e = String(Math.abs(lon)).padStart(3, "0");
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${ns}${n}${ew}${e}`;
}

export function copernicusWindows(bbox: SearchBbox): CoverageWindow[] {
  const windows: CoverageWindow[] = [];
  for (let lat = Math.floor(bbox.south); lat <= Math.floor(bbox.north); lat += 1) {
    for (let lon = Math.floor(bbox.west); lon <= Math.floor(bbox.east); lon += 1) {
      windows.push({
        sourceSlug: COPERNICUS_SOURCE_SLUG,
        coverageKey: `glo90:${copernicusTileName(lat, lon)}`,
        bbox: {
          west: lon,
          south: lat,
          east: lon + 1,
          north: lat + 1,
        },
      });
    }
  }
  return windows;
}

export function steppedWindows(bbox: SearchBbox, sourceSlug: string, prefix: string, step: number): CoverageWindow[] {
  return tilesForBbox(bbox, step).map((tile) => ({
    sourceSlug,
    coverageKey: `${prefix}:${step}:${tile.west.toFixed(4)}:${tile.south.toFixed(4)}`,
    bbox: tile,
  }));
}

export function nmdWindows(bbox: SearchBbox): CoverageWindow[] {
  return steppedWindows(bbox, NMD_SOURCE_SLUG, "nmd2023", NMD_WINDOW_STEP_DEG);
}

export function roadlinkWindows(bbox: SearchBbox): CoverageWindow[] {
  return steppedWindows(bbox, ROADLINK_SOURCE_SLUG, "road", ROADLINK_WINDOW_STEP_DEG);
}

export function floodWindows(bbox: SearchBbox): CoverageWindow[] {
  return steppedWindows(bbox, FLOOD_SOURCE_SLUG, "flood-bhf", FLOOD_WINDOW_STEP_DEG);
}

export function groundWindows(bbox: SearchBbox): CoverageWindow[] {
  return steppedWindows(bbox, GROUND_SOURCE_SLUG, "sgu-grundlager", GROUND_WINDOW_STEP_DEG);
}

export function dtmWindows(bbox: SearchBbox): CoverageWindow[] {
  return steppedWindows(bbox, DTM_SOURCE_SLUG, "dtm1m", DTM_WINDOW_STEP_DEG);
}

export function clipWindowToSearch(window: SearchBbox, search: SearchBbox): SearchBbox | null {
  const west = Math.max(window.west, search.west);
  const south = Math.max(window.south, search.south);
  const east = Math.min(window.east, search.east);
  const north = Math.min(window.north, search.north);
  if (west >= east || south >= north) return null;
  return { west, south, east, north };
}

export function needsOnDemandFetch(status: CoverageStatus | string | undefined): boolean {
  return status === "missing" || status === "partial" || status === "stale";
}
