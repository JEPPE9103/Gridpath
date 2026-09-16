/**
 * SGU ground / soil screening semantics.
 *
 * Official source: SGU Jordarter 1:25 000–1:100 000 (grundlager).
 * Thresholds are NOXHEIM screening assumptions — not geotechnical standards.
 * Mapped class percentages are screening-level composition, not site investigation.
 */

import type { SlopeConstraintMode } from "@/lib/opportunities/terrain";

export const GROUND_PROVIDER_KEY = "sgu-jordarter-25k-100k";
export const GROUND_DATASET_LABEL = "SGU Jordarter 1:25 000–1:100 000 (grundlager)";
export const GROUND_SOURCE_ATTRIBUTION = "Sveriges geologiska undersökning (SGU)";
export const GROUND_MAP_SCALE = "1:25 000–1:100 000";
export const GROUND_NORMALIZE_VERSION = "sgu-ground-normalize-v1";

/** Clay / fine sediment → RISK (screening assumption). */
export const GROUND_CLAY_RISK_PCT = 15;
/** Clay / fine sediment → MAJOR_RISK (screening assumption). */
export const GROUND_CLAY_MAJOR_RISK_PCT = 40;
/** Peat / organic → RISK (screening assumption). */
export const GROUND_PEAT_RISK_PCT = 5;
/** Peat / organic → MAJOR_RISK (screening assumption). */
export const GROUND_PEAT_MAJOR_RISK_PCT = 15;
/**
 * Hard exclusion only when profile sets groundMode = hard.
 * Default BESS profile does NOT hard-exclude on ground class.
 */
export const GROUND_HARD_EXCLUSION_PCT = 40;

export type GroundConstraintMode = SlopeConstraintMode;

export type GroundGroup =
  | "CLAY_FINE_SEDIMENT"
  | "SAND_GRAVEL"
  | "TILL"
  | "BEDROCK"
  | "PEAT_ORGANIC"
  | "OTHER"
  | "UNKNOWN";

export const GROUND_GROUP_LABELS: Record<GroundGroup, string> = {
  CLAY_FINE_SEDIMENT: "Clay / fine sediment",
  SAND_GRAVEL: "Sand / gravel",
  TILL: "Till / moraine",
  BEDROCK: "Bedrock / exposed rock",
  PEAT_ORGANIC: "Peat / organic ground",
  OTHER: "Other mapped ground",
  UNKNOWN: "Unclassified mapped ground",
};

export type GroundComposition = Partial<Record<GroundGroup, number>>;

export type GroundEvidenceInput = {
  groundQueried?: boolean;
  groundComposition?: GroundComposition | null;
  groundDominantGroup?: GroundGroup | string | null;
  groundSourceClasses?: string[] | null;
  groundProviderKey?: string | null;
  groundMapScale?: string | null;
  groundMode?: GroundConstraintMode | null;
  groundHardExclusionPct?: number | null;
  groundClayRiskPct?: number | null;
  groundClayMajorRiskPct?: number | null;
  groundPeatRiskPct?: number | null;
  groundPeatMajorRiskPct?: number | null;
};

const CLAY_CODES = new Set([
  40, 43, 44, 17, 19, 22, 24, 85, 86, 8186, 39, 16, 99, 98, 101, 9792, 9794, 9, 8806, 8919, 9060, 79,
]);
const PEAT_CODES = new Set([1, 5, 75, 8175, 6, 2306]);
const SAND_CODES = new Set([
  26, 13, 28, 31, 21, 87, 50, 55, 57, 51, 33, 34, 10, 62, 8937, 9010, 8809, 8803, 8802, 8804, 8814, 8950, 92,
  66,
]);
const TILL_CODES = new Set([100, 93, 95, 97, 9299, 9336, 9147]);
const BEDROCK_CODES = new Set([888, 890, 850, 849, 823, 9960, 9950]);

function textGroup(label: string): GroundGroup | null {
  const t = label.toLowerCase();
  if (!t) return null;
  if (/torv|gyttja|bleke|organisk/.test(t) && !/lera/.test(t)) return "PEAT_ORGANIC";
  if (/lera|silt|lerig morän|moränlera|moränfinlera|morängrovlera|gyttjelera/.test(t)) {
    return "CLAY_FINE_SEDIMENT";
  }
  if (/morän|till/.test(t)) return "TILL";
  if (/berg|urberg|diabas|sandsten|skålla/.test(t)) return "BEDROCK";
  if (/sand|grus|isälv|klapper|block|sten--|svall|älvsediment|svämsediment|flygsand|finsand/.test(t)) {
    return "SAND_GRAVEL";
  }
  if (/vatten|fyllning|oklass|glaciär|talus|vittring|flytjord|slamström/.test(t)) return "OTHER";
  return null;
}

/** Map SGU jg2 code (+ optional text) → screening group. Version: sgu-ground-normalize-v1. */
export function normalizeSguGroundClass(jg2: number | string | null | undefined, jg2Tx?: string | null): GroundGroup {
  const code = typeof jg2 === "string" ? Number.parseInt(jg2, 10) : jg2;
  if (typeof code === "number" && Number.isFinite(code)) {
    if (CLAY_CODES.has(code)) return "CLAY_FINE_SEDIMENT";
    if (PEAT_CODES.has(code)) return "PEAT_ORGANIC";
    if (TILL_CODES.has(code)) return "TILL";
    if (BEDROCK_CODES.has(code)) return "BEDROCK";
    if (SAND_CODES.has(code)) return "SAND_GRAVEL";
    if (code === 91 || code === 90 || code === 8114 || code === 200 || code === 322) return "OTHER";
  }
  const fromText = textGroup(jg2Tx ?? "");
  return fromText ?? "UNKNOWN";
}

export function isGroundGroup(value: string | null | undefined): value is GroundGroup {
  return (
    value === "CLAY_FINE_SEDIMENT" ||
    value === "SAND_GRAVEL" ||
    value === "TILL" ||
    value === "BEDROCK" ||
    value === "PEAT_ORGANIC" ||
    value === "OTHER" ||
    value === "UNKNOWN"
  );
}

export function formatGroundPct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "not measured";
  if (pct <= 0) return "0%";
  if (pct < 0.1) return "<0.1%";
  if (pct < 1) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct * 10) / 10}%`;
}

export function parseGroundComposition(value: unknown): GroundComposition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: GroundComposition = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isGroundGroup(key)) continue;
    const num = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
    if (!Number.isFinite(num) || num <= 0) continue;
    out[key] = num;
  }
  return out;
}

export function dominantGroundGroup(composition: GroundComposition | null | undefined): GroundGroup | null {
  let best: GroundGroup | null = null;
  let bestPct = -1;
  for (const [group, pct] of Object.entries(composition ?? {}) as Array<[GroundGroup, number]>) {
    if (pct > bestPct) {
      best = group;
      bestPct = pct;
    }
  }
  return best;
}

export function formatGroundComposition(composition: GroundComposition | null | undefined): string {
  const entries = Object.entries(composition ?? {})
    .filter(([, pct]) => typeof pct === "number" && pct > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number)) as Array<[GroundGroup, number]>;
  if (entries.length === 0) return "No mapped ground classes in the evaluated dataset.";
  return entries.map(([group, pct]) => `${GROUND_GROUP_LABELS[group]} — ${formatGroundPct(pct)}`).join("; ");
}

export function describeGroundComposition(input: {
  composition: GroundComposition | null | undefined;
  dominant?: GroundGroup | string | null;
}): string {
  const text = formatGroundComposition(input.composition);
  if (text.startsWith("No mapped")) {
    return `${text} This is screening-level mapped surficial geology, not a geotechnical investigation.`;
  }
  const dominant = isGroundGroup(input.dominant ?? null)
    ? (input.dominant as GroundGroup)
    : dominantGroundGroup(input.composition);
  const domLabel = dominant ? GROUND_GROUP_LABELS[dominant] : null;
  return `SGU mapping indicates ${text}${domLabel ? ` (dominant: ${domLabel})` : ""}. Mapped surficial geology at ${GROUND_MAP_SCALE} — screening-level evidence, not a site investigation.`;
}

export function groundGroupPct(composition: GroundComposition | null | undefined, group: GroundGroup): number {
  const value = composition?.[group];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
