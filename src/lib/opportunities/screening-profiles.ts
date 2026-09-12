import {
  isOpportunityTechnology,
  type OpportunityTechnologyValue,
} from "@/lib/opportunities/catalog";
import {
  NOXHEIM_DEFAULT_LAND_COVER_PROFILE,
  parseLandCoverProfile,
  type LandCoverProfile,
} from "@/lib/opportunities/land-cover";
import type { SlopeConstraintMode } from "@/lib/opportunities/terrain";

export const SCREENING_PROFILE_MATURITY = ["production", "beta", "unsupported"] as const;
export type ScreeningProfileMaturity = (typeof SCREENING_PROFILE_MATURITY)[number];

export const BESS_LAND_COVER_PROFILE: LandCoverProfile = {
  ...NOXHEIM_DEFAULT_LAND_COVER_PROFILE,
};

/** Conservative screening assumption — not an engineering design standard. */
export const SOLAR_LAND_COVER_PROFILE: LandCoverProfile = {
  water: "excluded",
  wetland: "excluded",
  forest: "deprioritised",
  agriculture: "preferred",
  open: "preferred",
  developed: "deprioritised",
  unclassified: "neutral",
};

/** Conservative screening envelope — not a turbine layout standard. */
export const WIND_LAND_COVER_PROFILE: LandCoverProfile = {
  water: "excluded",
  wetland: "excluded",
  forest: "preferred",
  agriculture: "neutral",
  open: "preferred",
  developed: "deprioritised",
  unclassified: "neutral",
};

export const SCREENING_PROFILE_ORIGIN = ["noxheim_default", "customer"] as const;
export type ScreeningProfileOrigin = (typeof SCREENING_PROFILE_ORIGIN)[number];

export type DevelopmentAssumptions = {
  maxInvestigationDistanceKm: number | null;
  investigationBudgetNote: string | null;
  hurdleNote: string | null;
};

export type ScreeningProfileCriteria = {
  technology: OpportunityTechnologyValue;
  targetMw: number | null;
  targetMwh: number | null;
  minSiteAreaHa: number | null;
  targetSiteAreaHa: number | null;
  maxCandidateAreaHa: number | null;
  maxReturnedCandidates: number | null;
  excludeProtected: boolean;
  excludeNatura: boolean;
  slopeMode: SlopeConstraintMode;
  maxSlopeDegrees: number | null;
  landCover: LandCoverProfile;
  maxRoadDistanceM: number | null;
  roadMode: SlopeConstraintMode;
  minDistanceResidentialM: number | null;
  assumptions: DevelopmentAssumptions;
};

export type ScreeningProfileRecord = {
  id: string | null;
  name: string;
  origin: ScreeningProfileOrigin;
  criteria: ScreeningProfileCriteria;
  maturity: ScreeningProfileMaturity;
  assumptionNote: string;
};

export const RANKING_VERSION = "suitability-v4";
export const METHODOLOGY_VERSION = "site-generation-v2.1";
export const RANKING_VERSION_V2 = "suitability-v2";
export const RANKING_VERSION_V3 = "suitability-v3";

export function screeningProfileMaturity(
  technology: OpportunityTechnologyValue,
): ScreeningProfileMaturity {
  if (technology === "battery_storage") return "production";
  if (technology === "solar" || technology === "wind" || technology === "hybrid") return "beta";
  return "unsupported";
}

export function screeningProfileAssumptionNote(technology: OpportunityTechnologyValue): string {
  if (technology === "battery_storage") {
    return "Sweden BESS Standard screening assumptions: 8 / 15 / 30 ha footprint preference, 5° slope preference, 1 km road preference, protected and Natura excluded. These are product screening defaults, not engineering design standards. Target MW does not change Candidate geometry.";
  }
  if (technology === "solar") {
    return "BETA solar screening assumptions: larger footprint preference (10 / 25 / 50 ha), 7° slope preference, open and agricultural land preferred, forest deprioritised. Configurable screening defaults, not a PV design standard. Target MW does not change Candidate geometry.";
  }
  if (technology === "wind") {
    return "BETA wind screening assumptions: large envelope (20 / 80 / 200 ha), 12° slope preference, open and forest preferred. Envelope is not a turbine pad or layout. Configurable screening defaults, not a wind-design standard. Target MW does not change Candidate geometry.";
  }
  if (technology === "hybrid") {
    return "BETA hybrid screening uses BESS-like footprint defaults. Technology does not invent a MW-to-land formula.";
  }
  return "This technology is selectable for labelling only. Spatial screening uses BESS-like footprint defaults until a dedicated pack exists.";
}

function packFor(technology: OpportunityTechnologyValue): Pick<
  ScreeningProfileCriteria,
  | "minSiteAreaHa"
  | "targetSiteAreaHa"
  | "maxCandidateAreaHa"
  | "maxReturnedCandidates"
  | "maxSlopeDegrees"
  | "slopeMode"
  | "maxRoadDistanceM"
  | "roadMode"
  | "landCover"
  | "excludeProtected"
  | "excludeNatura"
> {
  if (technology === "solar") {
    return {
      minSiteAreaHa: 10,
      targetSiteAreaHa: 25,
      maxCandidateAreaHa: 50,
      maxReturnedCandidates: 25,
      maxSlopeDegrees: 7,
      slopeMode: "preference",
      maxRoadDistanceM: 1500,
      roadMode: "preference",
      landCover: { ...SOLAR_LAND_COVER_PROFILE },
      excludeProtected: true,
      excludeNatura: true,
    };
  }
  if (technology === "wind") {
    return {
      minSiteAreaHa: 20,
      targetSiteAreaHa: 80,
      maxCandidateAreaHa: 200,
      maxReturnedCandidates: 25,
      maxSlopeDegrees: 12,
      slopeMode: "preference",
      maxRoadDistanceM: 2500,
      roadMode: "preference",
      landCover: { ...WIND_LAND_COVER_PROFILE },
      excludeProtected: true,
      excludeNatura: true,
    };
  }
  return {
    minSiteAreaHa: 8,
    targetSiteAreaHa: 15,
    maxCandidateAreaHa: 30,
    maxReturnedCandidates: 25,
    maxSlopeDegrees: 5,
    slopeMode: "preference",
    maxRoadDistanceM: 1000,
    roadMode: "preference",
    landCover: { ...BESS_LAND_COVER_PROFILE },
    excludeProtected: true,
    excludeNatura: true,
  };
}

export function defaultScreeningProfile(
  technology: OpportunityTechnologyValue = "battery_storage",
): ScreeningProfileRecord {
  const pack = packFor(technology);
  return {
    id: null,
    name: defaultProfileName(technology),
    origin: "noxheim_default",
    maturity: screeningProfileMaturity(technology),
    assumptionNote: screeningProfileAssumptionNote(technology),
    criteria: {
      technology,
      targetMw: null,
      targetMwh: null,
      minSiteAreaHa: pack.minSiteAreaHa,
      targetSiteAreaHa: pack.targetSiteAreaHa,
      maxCandidateAreaHa: pack.maxCandidateAreaHa,
      maxReturnedCandidates: pack.maxReturnedCandidates,
      excludeProtected: pack.excludeProtected,
      excludeNatura: pack.excludeNatura,
      slopeMode: pack.slopeMode,
      maxSlopeDegrees: pack.maxSlopeDegrees,
      landCover: pack.landCover,
      maxRoadDistanceM: pack.maxRoadDistanceM,
      roadMode: pack.roadMode,
      minDistanceResidentialM: null,
      assumptions: {
        maxInvestigationDistanceKm: null,
        investigationBudgetNote: null,
        hurdleNote: null,
      },
    },
  };
}

export function screeningPackFormDefaults(technology: OpportunityTechnologyValue): {
  minSiteAreaHa: string;
  targetSiteAreaHa: string;
  maxCandidateAreaHa: string;
  maxReturnedCandidates: string;
  maxSlopeDegrees: string;
  slopeMode: SlopeConstraintMode;
  maxRoadDistanceM: string;
  roadMode: SlopeConstraintMode;
  landCoverWater: string;
  landCoverWetland: string;
  landCoverForest: string;
  landCoverAgriculture: string;
  landCoverOpen: string;
  landCoverDeveloped: string;
} {
  const criteria = defaultScreeningProfile(technology).criteria;
  return {
    minSiteAreaHa: String(criteria.minSiteAreaHa ?? ""),
    targetSiteAreaHa: String(criteria.targetSiteAreaHa ?? ""),
    maxCandidateAreaHa: String(criteria.maxCandidateAreaHa ?? ""),
    maxReturnedCandidates: String(criteria.maxReturnedCandidates ?? "25"),
    maxSlopeDegrees: String(criteria.maxSlopeDegrees ?? ""),
    slopeMode: criteria.slopeMode,
    maxRoadDistanceM: String(criteria.maxRoadDistanceM ?? ""),
    roadMode: criteria.roadMode,
    landCoverWater: criteria.landCover.water,
    landCoverWetland: criteria.landCover.wetland,
    landCoverForest: criteria.landCover.forest,
    landCoverAgriculture: criteria.landCover.agriculture,
    landCoverOpen: criteria.landCover.open,
    landCoverDeveloped: criteria.landCover.developed,
  };
}

export function defaultProfileName(technology: OpportunityTechnologyValue): string {
  switch (technology) {
    case "battery_storage":
      return "Sweden BESS Standard";
    case "solar":
      return "Sweden solar screening";
    case "wind":
      return "Sweden wind screening";
    case "data_center":
      return "Sweden data-centre screening";
    case "industrial":
      return "Sweden industrial-load screening";
    default:
      return "Sweden screening";
  }
}

export function originLabel(origin: ScreeningProfileOrigin): string {
  return origin === "customer" ? "CUSTOMER CONFIGURED" : "NOXHEIM DEFAULT";
}

export function parseScreeningProfileCriteria(raw: unknown): ScreeningProfileCriteria {
  const rawTechnology =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>).technology : null;
  const technology: OpportunityTechnologyValue =
    typeof rawTechnology === "string" && isOpportunityTechnology(rawTechnology)
      ? rawTechnology
      : "battery_storage";
  const fallback = defaultScreeningProfile(technology).criteria;
  if (!raw || typeof raw !== "object") return fallback;
  const value = raw as Record<string, unknown>;
  return {
    technology,
    targetMw: numberOrNull(value.targetMw) ?? fallback.targetMw,
    targetMwh: numberOrNull(value.targetMwh) ?? fallback.targetMwh,
    minSiteAreaHa: numberOrNull(value.minSiteAreaHa) ?? fallback.minSiteAreaHa,
    targetSiteAreaHa: numberOrNull(value.targetSiteAreaHa) ?? fallback.targetSiteAreaHa,
    maxCandidateAreaHa: numberOrNull(value.maxCandidateAreaHa) ?? fallback.maxCandidateAreaHa,
    maxReturnedCandidates: numberOrNull(value.maxReturnedCandidates) ?? fallback.maxReturnedCandidates,
    excludeProtected: value.excludeProtected !== false,
    excludeNatura: value.excludeNatura !== false,
    slopeMode: value.slopeMode === "hard" ? "hard" : "preference",
    maxSlopeDegrees: numberOrNull(value.maxSlopeDegrees) ?? fallback.maxSlopeDegrees,
    landCover: parseLandCoverProfile(value.landCover),
    maxRoadDistanceM: numberOrNull(value.maxRoadDistanceM) ?? fallback.maxRoadDistanceM,
    roadMode: value.roadMode === "hard" ? "hard" : "preference",
    minDistanceResidentialM: numberOrNull(value.minDistanceResidentialM),
    assumptions: {
      maxInvestigationDistanceKm: numberOrNull(
        value.assumptions && typeof value.assumptions === "object"
          ? (value.assumptions as Record<string, unknown>).maxInvestigationDistanceKm
          : value.maxInvestigationDistanceKm,
      ),
      investigationBudgetNote: stringOrNull(
        value.assumptions && typeof value.assumptions === "object"
          ? (value.assumptions as Record<string, unknown>).investigationBudgetNote
          : value.investigationBudgetNote,
      ),
      hurdleNote: stringOrNull(
        value.assumptions && typeof value.assumptions === "object"
          ? (value.assumptions as Record<string, unknown>).hurdleNote
          : value.hurdleNote,
      ),
    },
  };
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
