/**
 * Coarse discovery vs detailed site screening.
 * 1 km summaries are discovery evidence only. They are never presented as
 * parcel-level or 1 m site geometry.
 */

export const SCREENING_STAGE_VALUES = ["discovery", "detailed"] as const;
export type ScreeningStage = (typeof SCREENING_STAGE_VALUES)[number];

export const REFINEMENT_STATUS_VALUES = [
  "discovery",
  "eligible_for_refinement",
  "refining",
  "refined",
  "refinement_failed",
  "saved_as_opportunity",
] as const;
export type RefinementStatus = (typeof REFINEMENT_STATUS_VALUES)[number];

export const EVIDENCE_RESOLUTION_VALUES = ["coarse", "detailed", "fallback", "unavailable"] as const;
export type EvidenceResolution = (typeof EVIDENCE_RESOLUTION_VALUES)[number];

export const STRATEGIC_FLAG_VALUES = [
  "LARGE_CONTIGUOUS_AREA",
  "FAVORABLE_TERRAIN",
  "ENVIRONMENTAL_CONFLICT",
  "ACCESS_REVIEW",
  "GRID_CONTEXT_PRESENT",
  "OFFICIAL_TRANSMISSION_CONTEXT_AVAILABLE",
  "HIGH_APPLICATION_VOLUME_REGION",
  "DATA_GAP_CRITICAL",
] as const;
export type StrategicFlag = (typeof STRATEGIC_FLAG_VALUES)[number];

export const TERRAIN_PROVIDER_PRIORITY = {
  detailed: "lantmateriet-dtm-1m",
  discoveryFallback: "copernicus-dem-glo90",
} as const;

export const LAND_COVER_PROVIDER_PRIORITY = {
  current: "nv-nmd-2023",
  legacyFallback: "nv-nmd-2018",
} as const;

export const DISCOVERY_RESOLUTION_M = 1000;
export const PRECISION_RESOLUTION_M = 100;
export const MAX_REFINE_CANDIDATES = 5;

export function isRefinementStatus(value: string): value is RefinementStatus {
  return (REFINEMENT_STATUS_VALUES as readonly string[]).includes(value);
}

export function isEvidenceResolution(value: string): value is EvidenceResolution {
  return (EVIDENCE_RESOLUTION_VALUES as readonly string[]).includes(value);
}

export function refinementStatusLabel(status: RefinementStatus): string {
  switch (status) {
    case "discovery":
      return "Discovery screening";
    case "eligible_for_refinement":
      return "Eligible for detailed site screening";
    case "refining":
      return "Detailed screening in progress";
    case "refined":
      return "Detailed site screening";
    case "refinement_failed":
      return "Detailed screening failed";
    case "saved_as_opportunity":
      return "Saved as opportunity";
  }
}

export function terrainEvidenceLabel(input: {
  resolution: EvidenceResolution;
  providerKey: string | null;
}): string {
  if (input.resolution === "unavailable" || !input.providerKey) {
    return "Terrain evidence: unavailable";
  }
  if (input.providerKey === TERRAIN_PROVIDER_PRIORITY.detailed && input.resolution === "detailed") {
    return "Terrain evidence: Detailed — Lantmäteriet 1 m DTM";
  }
  if (input.providerKey === TERRAIN_PROVIDER_PRIORITY.discoveryFallback) {
    return input.resolution === "fallback"
      ? "Terrain evidence: Coarse — Copernicus GLO-90 fallback"
      : "Terrain evidence: Coarse — Copernicus GLO-90";
  }
  return `Terrain evidence: ${input.resolution}`;
}

export function landCoverEvidenceLabel(input: {
  resolution: EvidenceResolution;
  providerKey: string | null;
}): string {
  if (input.resolution === "unavailable" || !input.providerKey) {
    return "Land cover: unavailable";
  }
  if (input.providerKey === LAND_COVER_PROVIDER_PRIORITY.current) {
    return input.resolution === "detailed"
      ? "Land cover: Detailed — NMD 2023"
      : "Land cover: Coarse discovery — NMD 2023 (1 km majority class)";
  }
  if (input.providerKey === LAND_COVER_PROVIDER_PRIORITY.legacyFallback) {
    return "Land cover: Legacy fallback — NMD 2018 (not current Swedish land-cover evidence)";
  }
  return `Land cover: ${input.resolution}`;
}

export function deriveStrategicFlags(input: {
  contiguousHa: number | null;
  minAreaHa: number | null;
  terrainFavorable: boolean;
  environmentalConflict: boolean;
  roadDistanceM: number | null;
  maxRoadDistanceM: number | null;
  localCovered: boolean;
  nupCovered: boolean;
  transmissionAvailable: boolean;
  highApplicationVolume: boolean;
  criticalGap: boolean;
}): StrategicFlag[] {
  const flags: StrategicFlag[] = [];
  if (input.contiguousHa != null && input.minAreaHa != null && input.contiguousHa >= input.minAreaHa * 2) {
    flags.push("LARGE_CONTIGUOUS_AREA");
  }
  if (input.terrainFavorable) flags.push("FAVORABLE_TERRAIN");
  if (input.environmentalConflict) flags.push("ENVIRONMENTAL_CONFLICT");
  if (
    input.roadDistanceM != null &&
    input.maxRoadDistanceM != null &&
    input.roadDistanceM > input.maxRoadDistanceM
  ) {
    flags.push("ACCESS_REVIEW");
  }
  if (input.localCovered || input.nupCovered) flags.push("GRID_CONTEXT_PRESENT");
  if (input.transmissionAvailable) flags.push("OFFICIAL_TRANSMISSION_CONTEXT_AVAILABLE");
  if (input.highApplicationVolume) flags.push("HIGH_APPLICATION_VOLUME_REGION");
  if (input.criticalGap) flags.push("DATA_GAP_CRITICAL");
  return flags;
}

export function explainRankChange(input: {
  name: string;
  discoveryRank: number | null;
  detailedRank: number | null;
  discoveryContiguousHa: number | null;
  refinedContiguousHa: number | null;
}): string | null {
  if (input.discoveryRank == null || input.detailedRank == null) return null;
  if (input.discoveryRank === input.detailedRank && input.discoveryContiguousHa === input.refinedContiguousHa) {
    return null;
  }
  const areaBefore = input.discoveryContiguousHa;
  const areaAfter = input.refinedContiguousHa;
  if (areaBefore != null && areaAfter != null && Math.abs(areaBefore - areaAfter) >= 0.1) {
    if (input.detailedRank < input.discoveryRank) {
      return `Discovery rank #${input.discoveryRank}. After detailed refinement: #${input.detailedRank}. Detailed terrain and land-cover evidence increased this candidate's relative priority. Contiguous usable area ${areaBefore.toFixed(1)} ha → ${areaAfter.toFixed(1)} ha.`;
    }
    if (input.detailedRank > input.discoveryRank) {
      return `Discovery rank #${input.discoveryRank}. Refined rank #${input.detailedRank}. Detailed analysis reduced contiguous usable area from ${areaBefore.toFixed(1)} ha to ${areaAfter.toFixed(1)} ha.`;
    }
    return `Detailed analysis changed contiguous usable area from ${areaBefore.toFixed(1)} ha to ${areaAfter.toFixed(1)} ha. Rank unchanged at #${input.detailedRank}.`;
  }
  if (input.detailedRank < input.discoveryRank) {
    return `Discovery rank #${input.discoveryRank}. After detailed refinement: #${input.detailedRank}. Detailed terrain and land-cover evidence increased this candidate's relative priority.`;
  }
  if (input.detailedRank > input.discoveryRank) {
    return `Discovery rank #${input.discoveryRank}. Refined rank #${input.detailedRank}.`;
  }
  return null;
}
