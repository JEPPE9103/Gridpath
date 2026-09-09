import type { OpportunityTechnologyValue } from "@/lib/opportunities/catalog";
import {
  NOXHEIM_DEFAULT_LAND_COVER_PROFILE,
  parseLandCoverProfile,
  type LandCoverProfile,
} from "@/lib/opportunities/land-cover";
import type { SlopeConstraintMode } from "@/lib/opportunities/terrain";

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
};

export const RANKING_VERSION = "suitability-v3";
export const METHODOLOGY_VERSION = "precision-screening-v1";
export const RANKING_VERSION_V2 = "suitability-v2";

export function defaultScreeningProfile(
  technology: OpportunityTechnologyValue = "battery_storage",
): ScreeningProfileRecord {
  return {
    id: null,
    name: defaultProfileName(technology),
    origin: "noxheim_default",
    criteria: {
      technology,
      targetMw: null,
      targetMwh: null,
      minSiteAreaHa: 8,
      excludeProtected: true,
      excludeNatura: true,
      slopeMode: "preference",
      maxSlopeDegrees: 5,
      landCover: { ...NOXHEIM_DEFAULT_LAND_COVER_PROFILE },
      maxRoadDistanceM: 1000,
      roadMode: "preference",
      minDistanceResidentialM: null,
      assumptions: {
        maxInvestigationDistanceKm: null,
        investigationBudgetNote: null,
        hurdleNote: null,
      },
    },
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
  const fallback = defaultScreeningProfile().criteria;
  if (!raw || typeof raw !== "object") return fallback;
  const value = raw as Record<string, unknown>;
  return {
    technology: fallback.technology,
    targetMw: numberOrNull(value.targetMw) ?? fallback.targetMw,
    targetMwh: numberOrNull(value.targetMwh) ?? fallback.targetMwh,
    minSiteAreaHa: numberOrNull(value.minSiteAreaHa) ?? fallback.minSiteAreaHa,
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
