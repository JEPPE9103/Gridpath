/**
 * Detailed terrain screening semantics (Lantmäteriet 1 m DTM).
 *
 * Thresholds are NOXHEIM screening assumptions — not earthworks design standards.
 * Coarse Copernicus GLO-90 must never be labelled as detailed terrain.
 */

import type { SlopeConstraintMode } from "@/lib/opportunities/terrain";

export const DETAILED_TERRAIN_PROVIDER_KEY = "lantmateriet-dtm-1m";
export const DETAILED_TERRAIN_DATASET_LABEL = "Lantmäteriet Markhöjdmodell 1 m DTM";
export const DETAILED_TERRAIN_SOURCE_ATTRIBUTION = "Lantmäteriet";
export const DETAILED_TERRAIN_RESOLUTION_M = 1;
export const DETAILED_TERRAIN_SUMMARY_RESOLUTION_M = 100;

/** Share of footprint above preferred slope → RISK (screening assumption). */
export const DETAILED_TERRAIN_STEEP_RISK_PCT = 15;
/** Share above preferred slope → MAJOR_RISK (screening assumption). */
export const DETAILED_TERRAIN_STEEP_MAJOR_RISK_PCT = 35;
/** Elevation range across footprint → RISK (screening assumption). */
export const DETAILED_TERRAIN_RELIEF_RISK_M = 12;
/** Elevation range → MAJOR_RISK when combined with steep share (screening assumption). */
export const DETAILED_TERRAIN_RELIEF_MAJOR_M = 25;

export type DetailedTerrainEvidenceInput = {
  detailedTerrainQueried?: boolean;
  terrainResolution?: string | null;
  terrainProviderKey?: string | null;
  meanSlopeDeg?: number | null;
  p90SlopeDeg?: number | null;
  maxSlopeDeg?: number | null;
  pctBelowSlope?: number | null;
  pctAboveSlope?: number | null;
  elevMinM?: number | null;
  elevMaxM?: number | null;
  elevRangeM?: number | null;
  maxSlopeDegrees?: number | null;
  slopeMode?: SlopeConstraintMode | null;
  steepRiskPct?: number | null;
  steepMajorRiskPct?: number | null;
  reliefRiskM?: number | null;
  reliefMajorM?: number | null;
};

export function formatSlopeDeg(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "not measured";
  return `${value.toFixed(1)}°`;
}

export function formatElevRangeM(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "not measured";
  if (value < 0.1) return "<0.1 m";
  return `${value.toFixed(1)} m`;
}

export function formatSteepPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "not measured";
  if (value <= 0) return "0%";
  if (value < 0.1) return "<0.1%";
  return `${value.toFixed(1)}%`;
}

export function describeDetailedTerrain(input: {
  meanSlopeDeg?: number | null;
  p90SlopeDeg?: number | null;
  pctAboveSlope?: number | null;
  elevRangeM?: number | null;
  thresholdDeg?: number | null;
}): string {
  const threshold = input.thresholdDeg ?? 5;
  const parts = [
    input.meanSlopeDeg != null ? `mean slope ${formatSlopeDeg(input.meanSlopeDeg)}` : null,
    input.p90SlopeDeg != null ? `P90 ${formatSlopeDeg(input.p90SlopeDeg)}` : null,
    input.elevRangeM != null ? `elevation range ${formatElevRangeM(input.elevRangeM)}` : null,
    input.pctAboveSlope != null
      ? `${formatSteepPct(input.pctAboveSlope)} of footprint above ${threshold}° screening preference`
      : null,
  ].filter(Boolean);
  if (parts.length === 0) {
    return "Detailed terrain was evaluated but no slope sample could be derived for this footprint.";
  }
  return `Detailed terrain indicates ${parts.join("; ")}. Screening-level mapped terrain — not an earthworks design.`;
}

export function isDetailedTerrainProvider(key: string | null | undefined): boolean {
  return key === DETAILED_TERRAIN_PROVIDER_KEY;
}

export function isDetailedTerrainEvaluated(input: {
  detailedTerrainQueried?: boolean | null;
  terrainResolution?: string | null;
  terrainProviderKey?: string | null;
}): boolean {
  if (input.detailedTerrainQueried === true) return true;
  if (input.terrainResolution === "detailed" && isDetailedTerrainProvider(input.terrainProviderKey)) {
    return true;
  }
  return false;
}

/** Screening severity from steep share + relief. NOXHEIM screening assumptions. */
export function classifyDetailedTerrainSeverity(input: {
  pctAboveSlope?: number | null;
  elevRangeM?: number | null;
  meanSlopeDeg?: number | null;
  maxSlopeDegrees?: number | null;
  slopeMode?: SlopeConstraintMode | null;
  steepRiskPct?: number | null;
  steepMajorRiskPct?: number | null;
  reliefRiskM?: number | null;
  reliefMajorM?: number | null;
}): {
  id:
    | "detailed_terrain_steep_hard_exclusion"
    | "detailed_terrain_steep_major"
    | "detailed_terrain_steep_risk"
    | "detailed_terrain_relief_major"
    | "detailed_terrain_relief_risk"
    | "detailed_terrain_context";
  severity: "blocker" | "major_risk" | "risk" | "info";
} {
  const steepRisk = input.steepRiskPct ?? DETAILED_TERRAIN_STEEP_RISK_PCT;
  const steepMajor = input.steepMajorRiskPct ?? DETAILED_TERRAIN_STEEP_MAJOR_RISK_PCT;
  const reliefRisk = input.reliefRiskM ?? DETAILED_TERRAIN_RELIEF_RISK_M;
  const reliefMajor = input.reliefMajorM ?? DETAILED_TERRAIN_RELIEF_MAJOR_M;
  const threshold = input.maxSlopeDegrees ?? 5;
  const steep = input.pctAboveSlope ?? 0;
  const relief = input.elevRangeM ?? 0;
  const mean = input.meanSlopeDeg ?? 0;
  const hard = input.slopeMode === "hard";

  if (hard && (mean > threshold || steep >= steepMajor)) {
    return { id: "detailed_terrain_steep_hard_exclusion", severity: "blocker" };
  }
  if (steep >= steepMajor || (relief >= reliefMajor && steep >= steepRisk)) {
    return { id: "detailed_terrain_steep_major", severity: "major_risk" };
  }
  if (relief >= reliefMajor) {
    return { id: "detailed_terrain_relief_major", severity: "major_risk" };
  }
  if (steep >= steepRisk) {
    return { id: "detailed_terrain_steep_risk", severity: "risk" };
  }
  if (relief >= reliefRisk) {
    return { id: "detailed_terrain_relief_risk", severity: "risk" };
  }
  return { id: "detailed_terrain_context", severity: "info" };
}
