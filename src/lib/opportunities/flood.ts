/**
 * Flood / water screening semantics.
 *
 * Official source: MSB/MCF översvämningskartering (BHF layer).
 * Thresholds are product screening assumptions — not engineering standards.
 * "No mapped overlap" is not the same as absent flood exposure.
 */

import type { SlopeConstraintMode } from "@/lib/opportunities/terrain";

export const FLOOD_PROVIDER_KEY = "msb-oversvamningskartering";
export const FLOOD_DATASET_LABEL = "MSB översvämningskartering (BHF)";
export const FLOOD_SOURCE_ATTRIBUTION = "Myndigheten för civilt försvar / MSB";

/** Edge / limited overlap → RISK (screening assumption). */
export const FLOOD_RISK_OVERLAP_PCT = 1;

/** Material footprint overlap → MAJOR_RISK (screening assumption). */
export const FLOOD_MAJOR_RISK_OVERLAP_PCT = 10;

/**
 * Hard exclusion only when the active profile sets floodMode = hard.
 * Default BESS profile does NOT hard-exclude on flood overlap.
 */
export const FLOOD_HARD_EXCLUSION_PCT = 1;

export type FloodConstraintMode = SlopeConstraintMode;

export type FloodEvidenceInput = {
  floodQueried?: boolean;
  floodOverlapPct?: number | null;
  floodOverlapHa?: number | null;
  floodClasses?: string[] | null;
  floodMode?: FloodConstraintMode | null;
  floodHardExclusionPct?: number | null;
  floodRiskOverlapPct?: number | null;
  floodMajorRiskOverlapPct?: number | null;
};

export function formatFloodOverlapPct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "not measured";
  if (pct <= 0) return "0%";
  if (pct < 0.1) return "<0.1%";
  return `${pct.toFixed(1)}%`;
}

export function floodClassLabel(classes: string[] | null | undefined): string {
  const unique = [...new Set((classes ?? []).map((item) => item.trim().toLowerCase()).filter(Boolean))];
  if (unique.includes("bhf")) return "Calculated highest flow (BHF)";
  if (unique.length === 0) return "Mapped flood geography";
  return unique.join(", ");
}

export function describeFloodOverlap(input: {
  overlapPct: number | null | undefined;
  classes?: string[] | null;
}): string {
  const pct = input.overlapPct ?? 0;
  const label = floodClassLabel(input.classes);
  if (pct <= 0) {
    return `No overlap identified with ${label} in the evaluated official dataset. This is not a finding that flood exposure is absent.`;
  }
  return `Mapped flood geography (${label}) intersects ${formatFloodOverlapPct(pct)} of the Candidate footprint.`;
}
