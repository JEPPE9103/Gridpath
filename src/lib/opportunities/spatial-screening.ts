/**
 * Geographic screening helpers for Swedish opportunity search.
 *
 * Analysis uses screening cells internally. User-facing results are contiguous
 * Candidate Areas after official exclusions, dissolve, and minimum-area checks.
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
export const SLIVER_AREA_HA = 0.5;
export const CONTIGUITY_RULE =
  "4-connected shared-boundary dissolve: remaining usable polygons that share an edge are unioned; corner-only and disconnected fragments stay separate. Centroids are not used.";

export const SCREENING_CRS_METRIC = "EPSG:3006";
export const SCREENING_CRS_STORAGE = "EPSG:4326";

export const SCREENING_METHODOLOGY = [
  "Bounded search geography is clipped to the Swedish envelope and divided into square analysis cells in SWEREF 99 TM (EPSG:3006).",
  `Cell size is clamp(${SCREENING_CELL_MIN_METERS}, ${SCREENING_CELL_MAX_METERS}, sqrt(area_m2 / ${SCREENING_CELL_TARGET_COUNT})) metres, targeting about ${SCREENING_CELL_TARGET_COUNT} analysis cells.`,
  "Official exclusion polygons (protected areas, Natura 2000, and configured hard terrain/land-cover summaries when ingested) are subtracted with ST_Difference.",
  `${CONTIGUITY_RULE} Geometry is repaired with ST_MakeValid / ST_CollectionExtract; slivers below 0.5 ha are dropped.`,
  "The user-facing object is a Candidate Area: the contiguous remaining usable polygon, not the original analysis square and not a cadastral parcel.",
  "Screening is two-stage: DISCOVERY SCREENING (coarse, ~1 km summaries) then DETAILED SITE SCREENING on at most five Candidate Areas.",
  "Screening decisions use largest contiguous usable area, not the sum of disconnected leftovers.",
  "Hard exclusions use official protected-area and Natura 2000 polygons when ingested. Remaining overlap at or above 1% of a fragment fails the configured exclusion.",
  "LOCAL/DISTRIBUTION CONTEXT uses official Ei covering geography at the candidate centroid. TRANSMISSION CONTEXT is official SvK county indication when a structured source exists. PROJECT-SPECIFIC CONNECTION is unknown unless customer or case-specific official evidence exists.",
  "Covering geography is not a connection point and is not available capacity. County-level official transmission indications are not site capacity.",
  "Discovery terrain is Copernicus DEM GLO-90 (DSM, 90 m) when ingested. Detailed terrain prefers Lantmäteriet 1 m DTM on-demand when Geotorget is configured.",
  "Current land cover is Naturvårdsverket NMD 2023 basskikt v0.3. Discovery may use 1 km majority class. Detailed screening uses class composition inside the Candidate Area. NMD 2018 is legacy fallback only.",
  "Road proximity uses Trafikverket INSPIRE RoadLink when that ingest succeeds. Residential proximity is blocked pending data rights.",
].join(" ");

export type SearchBbox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export function bboxFromCorners(
  a: { lng: number; lat: number },
  b: { lng: number; lat: number },
): SearchBbox {
  return {
    west: Math.min(a.lng, b.lng),
    south: Math.min(a.lat, b.lat),
    east: Math.max(a.lng, b.lng),
    north: Math.max(a.lat, b.lat),
  };
}

export function formatBboxCoordinate(value: number): string {
  return value.toFixed(4);
}

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
    return {
      ok: false,
      error: "Enter the four edges of the area to screen (west, south, east and north) in decimal degrees.",
    };
  }
  if (west == null || south == null || east == null || north == null) {
    return {
      ok: false,
      error: "Enter all four edges of the search area: west, south, east and north.",
    };
  }
  if (![west, south, east, north].every((value) => Number.isFinite(value))) {
    return { ok: false, error: "Search-area coordinates must be numbers in decimal degrees." };
  }
  if (west < -180 || east > 180 || west >= east) {
    return {
      ok: false,
      error: "West must be west of east. Use decimal degrees between -180 and 180.",
      field: "west",
    };
  }
  if (south < -90 || north > 90 || south >= north) {
    return {
      ok: false,
      error: "South must be south of north. Use decimal degrees between -90 and 90.",
      field: "south",
    };
  }
  const clipped = intersectSwedenEnvelope({ west, south, east, north });
  if (!clipped) {
    return {
      ok: false,
      error: "That search area does not overlap Sweden. NOXHEIM currently screens Swedish geography only.",
    };
  }
  const areaKm2 = bboxAreaKm2(clipped);
  if (areaKm2 > MAX_SEARCH_BBOX_KM2) {
    return {
      ok: false,
      error: `Search area is ${areaKm2.toFixed(0)} km². Maximum for this release is ${MAX_SEARCH_BBOX_KM2} km². Narrow the west–east and south–north extents.`,
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
  "Residential proximity (blocked pending Lantmäteriet / GDPR-safe building data rights)",
  "Electricity infrastructure proximity (substations, lines) — blocked pending a commercially reusable source",
  "Available connection capacity (NOXHEIM does not estimate it)",
  "Official SvK 2026 county transmission map (no production-safe structured source; not scraped)",
  "Municipal planning status",
  "Land ownership / legal access",
  "Official electricity-area (SE1–SE4) geometry (no production-safe reusable GIS ingest)",
  "Lantmäteriet 1 m DTM until Geotorget credentials are configured (Copernicus GLO-90 remains discovery fallback)",
] as const;
