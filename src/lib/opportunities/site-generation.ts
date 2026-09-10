/**
 * Site-generation v2.1 — Candidate Sites grown from usable land units, not seed buffers.
 *
 * Search area: customer bbox (may be hundreds of km²).
 * Opportunity zone: dissolved remaining region after hard exclusions (regional continuity).
 * Candidate site: contiguous eligible land grown around a seed until the target
 * preference is met, or neighbours run out, or the maximum is reached.
 *
 * Algorithm (deterministic, versioned as site-generation-v2.1):
 * 1. Keep ST_UnaryUnion + ST_Dump as Opportunity Zones.
 * 2. Cover each zone with a 150 m SWEREF 99 TM square grid, clipped to remaining
 *    usable geography. Units inherit land-cover / terrain scores. Excluded
 *    land-cover classes (water/wetland by default) are ineligible.
 * 3. Seeds are the highest-scoring unused eligible units. No LLM. No random.
 * 4. Region-grow 4-connected (shared edge) through eligible neighbours, always
 *    adding the highest-scoring neighbour that still fits under maximum area.
 *    Stop when usable area >= target, or no neighbour remains, or max is hit.
 *    Do not reshape to force exact target area.
 * 5. Dissolve selected units. Keep the largest polygon if the union fragments.
 * 6. Drop growths below minimum contiguous usable area.
 * 7. Cells are exclusive (marked used), then IoU >= SITE_DEDUPE_IOU as a safety net.
 * 8. Cap returned sites at maxReturnedCandidates (default 25, hard cap 100).
 * 9. Geometry quality is screening-only and must not prefer circles.
 *
 * Extra hectares above the configured target do not add ranking benefit.
 */

export const SITE_GENERATION_VERSION = "site-generation-v2.1";
export const RANKING_VERSION_V4 = "suitability-v4";

export const NOXHEIM_DEFAULT_MIN_SITE_AREA_HA = 8;
export const NOXHEIM_DEFAULT_TARGET_SITE_AREA_HA = 15;
export const NOXHEIM_DEFAULT_MAX_CANDIDATE_AREA_HA = 30;
export const NOXHEIM_DEFAULT_MAX_RETURNED_SITES = 25;
export const SITE_RETURN_HARD_CAP = 100;

export const SITE_CELL_M = 150;
export const SITE_DEDUPE_IOU = 0.5;
export const SITE_MIN_SEPARATION_FACTOR = 0.75;
export const SITE_COMPACTNESS_REVIEW = 0.12;
export const SITE_ASPECT_REVIEW = 6;
export const SITE_NECK_BUFFER_M = 40;
export const SITE_NECK_AREA_DROP = 0.45;
export const SITE_USABLE_RATIO_REVIEW = 0.35;

export type SiteAreaProfile = {
  minHa: number;
  targetHa: number;
  maxHa: number;
  maxReturned: number;
};

export function resolveSiteAreaProfile(input: {
  minSiteAreaHa?: number | null;
  targetSiteAreaHa?: number | null;
  maxCandidateAreaHa?: number | null;
  maxReturnedCandidates?: number | null;
}): SiteAreaProfile {
  const minHa = positiveOr(input.minSiteAreaHa, NOXHEIM_DEFAULT_MIN_SITE_AREA_HA);
  const targetHa = Math.max(minHa, positiveOr(input.targetSiteAreaHa, NOXHEIM_DEFAULT_TARGET_SITE_AREA_HA));
  const maxHa = Math.max(targetHa, positiveOr(input.maxCandidateAreaHa, NOXHEIM_DEFAULT_MAX_CANDIDATE_AREA_HA));
  const maxReturned = Math.min(
    SITE_RETURN_HARD_CAP,
    Math.max(1, Math.round(positiveOr(input.maxReturnedCandidates, NOXHEIM_DEFAULT_MAX_RETURNED_SITES))),
  );
  return { minHa, targetHa, maxHa, maxReturned };
}

export function siteMinSeparationM(targetHa: number): number {
  return SITE_MIN_SEPARATION_FACTOR * Math.sqrt(Math.max(targetHa, 0.5) * 10_000);
}

export function compactnessScore(areaM2: number, perimeterM: number): number {
  if (!(areaM2 > 0) || !(perimeterM > 0)) return 0;
  return (4 * Math.PI * areaM2) / (perimeterM * perimeterM);
}

export function aspectRatioFromEnvelope(widthM: number, heightM: number): number {
  const a = Math.max(widthM, heightM);
  const b = Math.min(widthM, heightM);
  if (!(b > 0)) return Number.POSITIVE_INFINITY;
  return a / b;
}

export function geometryQualityFromMetrics(input: {
  compactness: number;
  coreAreaRatio: number | null;
  aspectRatio?: number | null;
  partCount?: number | null;
  usableRatio?: number | null;
}): { label: "pass" | "review"; reason: string } {
  if ((input.partCount ?? 1) > 1) {
    return {
      label: "review",
      reason: "Candidate is fragmented into multiple polygons. Screening geometry quality only — not constructability.",
    };
  }
  if (input.compactness < SITE_COMPACTNESS_REVIEW) {
    return {
      label: "review",
      reason: "Candidate is a narrow corridor or highly irregular relative to its area. Screening geometry quality only — not constructability.",
    };
  }
  if (input.aspectRatio != null && input.aspectRatio > SITE_ASPECT_REVIEW) {
    return {
      label: "review",
      reason: "Candidate is elongated (high length-to-width). Screening geometry quality only — not constructability.",
    };
  }
  if (input.coreAreaRatio != null && input.coreAreaRatio < 1 - SITE_NECK_AREA_DROP) {
    return {
      label: "review",
      reason: "Candidate contains a narrow connection between larger usable sections. Screening geometry quality only — not constructability.",
    };
  }
  if (input.usableRatio != null && input.usableRatio < SITE_USABLE_RATIO_REVIEW) {
    return {
      label: "review",
      reason: "Usable geometry is a small fraction of the envelope (holes or excessive boundary complexity). Screening geometry quality only — not constructability.",
    };
  }
  return {
    label: "pass",
    reason: "Shape is practical enough for screening comparison. Compactness is not a preference for circular sites.",
  };
}

export function targetFitAssessment(
  usableHa: number,
  profile: SiteAreaProfile,
): { score: number; label: string } {
  if (!(usableHa > 0) || usableHa < profile.minHa) {
    return {
      score: 0,
      label: `Below the configured minimum ${profile.minHa} ha contiguous usable area.`,
    };
  }
  if (usableHa <= profile.targetHa) {
    const span = Math.max(profile.targetHa - profile.minHa, 0.01);
    const score = 0.55 + (0.45 * (usableHa - profile.minHa)) / span;
    return {
      score: Math.min(1, score),
      label: `Approaching configured target ${profile.targetHa} ha (${usableHa.toFixed(1)} ha usable). Target is a preference, not a required footprint.`,
    };
  }
  if (usableHa <= profile.maxHa) {
    return {
      score: 1,
      label: `Strong target-area fit. Configured target ${profile.targetHa} ha; candidate ${usableHa.toFixed(1)} ha stays within the ${profile.maxHa} ha maximum. Extra hectares do not add ranking benefit.`,
    };
  }
  return {
    score: Math.max(0.15, profile.targetHa / usableHa),
    label: `Area exceeds the configured ${profile.maxHa} ha maximum candidate size. Size itself provides no additional ranking benefit beyond the ${profile.targetHa} ha target.`,
  };
}

export function cardinalDirection(dx: number, dy: number): string {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) {
    return "Central";
  }
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const ns = dy >= 0 ? "North" : "South";
  const ew = dx >= 0 ? "East" : "West";
  if (adx < ady * 0.4) return ns;
  if (ady < adx * 0.4) return ew;
  return `${ns}-${ew}`;
}

export function siteDisplayName(input: {
  municipality?: string | null;
  region?: string | null;
  longitude: number;
  latitude: number;
  west: number;
  south: number;
  east: number;
  north: number;
  siteIndex: number;
}): string {
  const place =
    (input.municipality && input.municipality.trim()) ||
    (input.region && input.region.trim()) ||
    "Search";
  const cx = (input.west + input.east) / 2;
  const cy = (input.south + input.north) / 2;
  const direction = cardinalDirection(input.longitude - cx, input.latitude - cy);
  const n = String(Math.max(1, Math.round(input.siteIndex))).padStart(2, "0");
  return `${place} ${direction} - Site ${n}`;
}

function positiveOr(value: number | null | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0) return fallback;
  return value;
}
