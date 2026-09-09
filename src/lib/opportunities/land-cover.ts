/**
 * Naturvårdsverket NMD 2018 basskikt class mapping.
 *
 * Raster values follow the published NMD 2018 thematic codes (basskikt).
 * Unknown codes stay unclassified — they are never inferred as a preferred class.
 * Evaluation is always against the organisation screening profile, not a universal
 * “good/bad land” rule.
 */

export const LAND_COVER_GROUPS = [
  "water",
  "wetland",
  "forest",
  "agriculture",
  "open",
  "developed",
  "unclassified",
] as const;

export type LandCoverGroup = (typeof LAND_COVER_GROUPS)[number];

export const LAND_COVER_RULES = ["preferred", "neutral", "deprioritised", "excluded"] as const;

export type LandCoverRule = (typeof LAND_COVER_RULES)[number];

export type LandCoverProfile = Record<LandCoverGroup, LandCoverRule>;

export const NOXHEIM_DEFAULT_LAND_COVER_PROFILE: LandCoverProfile = {
  water: "excluded",
  wetland: "excluded",
  forest: "neutral",
  agriculture: "deprioritised",
  open: "preferred",
  developed: "deprioritised",
  unclassified: "neutral",
};

/** NMD 2018 basskikt pixel value → screening group. */
export function nmdClassToGroup(code: number | null | undefined): LandCoverGroup {
  if (code == null || !Number.isFinite(code)) return "unclassified";
  const value = Math.trunc(code);
  if (value === 2 || value === 3) return "water";
  if (value >= 41 && value <= 47) return "forest";
  if (value >= 51 && value <= 55) return "forest";
  if (value === 61) return "open";
  if (value === 62) return "wetland";
  if (value === 71) return "wetland";
  if (value === 81) return "agriculture";
  if (value === 82 || value === 83) return "open";
  if (value >= 84 && value <= 86) return "developed";
  return "unclassified";
}

export function isLandCoverGroup(value: string): value is LandCoverGroup {
  return (LAND_COVER_GROUPS as readonly string[]).includes(value);
}

export function isLandCoverRule(value: string): value is LandCoverRule {
  return (LAND_COVER_RULES as readonly string[]).includes(value);
}

export function parseLandCoverProfile(raw: unknown): LandCoverProfile {
  const next: LandCoverProfile = { ...NOXHEIM_DEFAULT_LAND_COVER_PROFILE };
  if (!raw || typeof raw !== "object") return next;
  for (const group of LAND_COVER_GROUPS) {
    const value = (raw as Record<string, unknown>)[group];
    if (typeof value === "string" && isLandCoverRule(value)) {
      next[group] = value;
    }
  }
  return next;
}

export function excludedLandCoverGroups(profile: LandCoverProfile): LandCoverGroup[] {
  return LAND_COVER_GROUPS.filter((group) => profile[group] === "excluded");
}

export type LandCoverComposition = Record<LandCoverGroup, number>;

export function emptyLandCoverComposition(): LandCoverComposition {
  return {
    water: 0,
    wetland: 0,
    forest: 0,
    agriculture: 0,
    open: 0,
    developed: 0,
    unclassified: 0,
  };
}

export function normalizeLandCoverComposition(
  shares: Partial<Record<LandCoverGroup, number>>,
): LandCoverComposition {
  const composition = emptyLandCoverComposition();
  let total = 0;
  for (const group of LAND_COVER_GROUPS) {
    const value = shares[group];
    composition[group] = value != null && Number.isFinite(value) && value > 0 ? value : 0;
    total += composition[group];
  }
  if (total <= 0) return composition;
  for (const group of LAND_COVER_GROUPS) {
    composition[group] = (composition[group] / total) * 100;
  }
  return composition;
}

export function landCoverShareForRule(
  composition: LandCoverComposition,
  profile: LandCoverProfile,
  rule: LandCoverRule,
): number {
  return LAND_COVER_GROUPS.reduce((sum, group) => {
    return profile[group] === rule ? sum + composition[group] : sum;
  }, 0);
}

export function landCoverPreferenceScore(
  composition: LandCoverComposition,
  profile: LandCoverProfile,
): number {
  const preferred = landCoverShareForRule(composition, profile, "preferred");
  const deprioritised = landCoverShareForRule(composition, profile, "deprioritised");
  return (preferred - deprioritised) / 100;
}
