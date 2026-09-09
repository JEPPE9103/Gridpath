/**
 * Geographic screening helpers for Swedish opportunity search.
 *
 * Candidate generation uses screening cells, not land parcels.
 * Recommendation is relative investigation priority from configured criteria
 * and currently supported evidence — not “best site”, buildability, or connection chance.
 */

export const SCREENING_CELL_TARGET_COUNT = 200;
export const SCREENING_CELL_MIN_METERS = 2000;
export const SCREENING_CELL_MAX_METERS = 10_000;
export const MAX_SEARCH_BBOX_KM2 = 15_000;
export const SWEDEN_WEST = 10.5;
export const SWEDEN_SOUTH = 55.0;
export const SWEDEN_EAST = 24.5;
export const SWEDEN_NORTH = 69.6;

export const SCREENING_CRS_METRIC = "EPSG:3006";
export const SCREENING_CRS_STORAGE = "EPSG:4326";

export const SCREENING_METHODOLOGY = [
  "Bounded search geography is clipped to the Swedish envelope and divided into square screening cells in SWEREF 99 TM (EPSG:3006).",
  `Cell size is clamp(${SCREENING_CELL_MIN_METERS}, ${SCREENING_CELL_MAX_METERS}, sqrt(area_m2 / ${SCREENING_CELL_TARGET_COUNT})) metres, targeting about ${SCREENING_CELL_TARGET_COUNT} cells.`,
  "Results are candidate / screening areas, not cadastral parcels or land available for purchase.",
  "Adjacent qualifying cells are not merged in this release, so neighbouring cells can remain separate ranked areas.",
  "Hard exclusions use official protected-area and Natura 2000 polygons when ingested. Overlap at or above 1% of cell area fails the configured exclusion.",
  "Usable area is cell area minus configured overlapping exclusion polygons. It is not legal land availability.",
  "Grid context uses official Ei covering geography at the cell centroid. Covering is not a connection point and is not available capacity.",
  "Terrain, land cover, roads, planning, land ownership, substations, and connection capacity are unsupported unless a dedicated official provider is ingested.",
].join(" ");

export type SearchBbox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type BboxValidation =
  | { ok: true; bbox: SearchBbox; areaKm2: number; cellSizeMeters: number }
  | { ok: false; error: string; field?: keyof SearchBbox };

export function screeningCellSizeMeters(areaM2: number): number {
  if (!Number.isFinite(areaM2) || areaM2 <= 0) {
    return SCREENING_CELL_MAX_METERS;
  }
  const raw = Math.sqrt(areaM2 / SCREENING_CELL_TARGET_COUNT);
  return Math.max(SCREENING_CELL_MIN_METERS, Math.min(SCREENING_CELL_MAX_METERS, Math.round(raw)));
}

export function bboxAreaKm2(bbox: SearchBbox): number {
  const west = Math.min(bbox.west, bbox.east);
  const east = Math.max(bbox.west, bbox.east);
  const south = Math.min(bbox.south, bbox.north);
  const north = Math.max(bbox.south, bbox.north);
  const meanLat = ((south + north) / 2) * (Math.PI / 180);
  const kmPerDegLat = 110.574;
  const kmPerDegLon = 111.32 * Math.cos(meanLat);
  const height = (north - south) * kmPerDegLat;
  const width = (east - west) * kmPerDegLon;
  return Math.abs(width * height);
}

export function intersectSwedenEnvelope(bbox: SearchBbox): SearchBbox | null {
  const west = Math.max(bbox.west, SWEDEN_WEST);
  const south = Math.max(bbox.south, SWEDEN_SOUTH);
  const east = Math.min(bbox.east, SWEDEN_EAST);
  const north = Math.min(bbox.north, SWEDEN_NORTH);
  if (west >= east || south >= north) return null;
  return { west, south, east, north };
}

export function validateSearchBbox(input: {
  west: number | null;
  south: number | null;
  east: number | null;
  north: number | null;
}): BboxValidation {
  const { west, south, east, north } = input;
  if (west == null && south == null && east == null && north == null) {
    return { ok: false, error: "Enter a search bounding box for geographic screening." };
  }
  if (west == null || south == null || east == null || north == null) {
    return { ok: false, error: "Enter west, south, east and north for the search bounding box." };
  }
  if (![west, south, east, north].every((value) => Number.isFinite(value))) {
    return { ok: false, error: "Bounding box coordinates must be finite numbers." };
  }
  if (west < -180 || east > 180 || west >= east) {
    return { ok: false, error: "West must be less than east, between -180 and 180.", field: "west" };
  }
  if (south < -90 || north > 90 || south >= north) {
    return { ok: false, error: "South must be less than north, between -90 and 90.", field: "south" };
  }
  const clipped = intersectSwedenEnvelope({ west, south, east, north });
  if (!clipped) {
    return {
      ok: false,
      error: "The bounding box does not intersect the supported Swedish envelope.",
    };
  }
  const areaKm2 = bboxAreaKm2(clipped);
  if (areaKm2 > MAX_SEARCH_BBOX_KM2) {
    return {
      ok: false,
      error: `Search area is ${areaKm2.toFixed(0)} km². Maximum for this release is ${MAX_SEARCH_BBOX_KM2} km². Narrow the bounding box.`,
    };
  }
  const areaM2 = areaKm2 * 1_000_000;
  return {
    ok: true,
    bbox: clipped,
    areaKm2,
    cellSizeMeters: screeningCellSizeMeters(areaM2),
  };
}

export function parseElectricityArea(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim().toUpperCase();
  if (!value) return null;
  if (!/^SE[1-4]$/.test(value)) return null;
  return value;
}

export function electricityAreaSpatialWarning(area: string | null): string | null {
  if (!area) return null;
  return `Electricity area ${area} is recorded as search intent. Official reusable bidding-zone geometry is not integrated, so it was not used as a spatial filter.`;
}

export type RunCountSnapshot = {
  evaluatedCount: number;
  excludedCount: number;
  returnedCount: number;
};

export function describeRunDelta(previous: RunCountSnapshot | null, current: RunCountSnapshot): string | null {
  if (!previous) return null;
  const removed = previous.returnedCount - current.returnedCount;
  if (removed === 0) {
    return `Previous run returned ${previous.returnedCount} candidate areas; this run returned ${current.returnedCount}.`;
  }
  if (removed > 0) {
    return `Previous run: ${previous.returnedCount} candidate areas. Current run: ${current.returnedCount}. ${removed} fewer returned than the previous execution.`;
  }
  return `Previous run: ${previous.returnedCount} candidate areas. Current run: ${current.returnedCount}. ${Math.abs(removed)} more returned than the previous execution.`;
}

export const UNSUPPORTED_SCREENING_DIMENSIONS = [
  "Terrain / slope (Lantmäteriet Grid 50+ not ingested in this release)",
  "Land cover / land use",
  "Electricity infrastructure proximity (substations, lines)",
  "Available connection capacity",
  "Municipal planning status",
  "Road access / logistics",
  "Residential proximity",
  "Land ownership / legal access",
  "Official electricity-area (SE1–SE4) geometry",
] as const;
