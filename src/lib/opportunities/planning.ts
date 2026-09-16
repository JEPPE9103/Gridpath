/**
 * Municipal detailed-plan / planning evidence (coverage-aware).
 *
 * Official planning geometry is CONTEXT for early desktop pre-feasibility —
 * not planning-law advice, permitting prediction, or development-right confirmation.
 * Inside a mapped plan is NOT automatically good; outside is NOT automatically bad.
 */
import {
  MALMO_PLANNING_PROVIDER_KEY,
  MALMO_PLANNING_SOURCE_SLUG,
} from "@/lib/opportunities/planning-providers";

export const PLANNING_NORMALIZE_VERSION = "planning-normalize-v1";
export const PLANNING_PROVIDER_KEY = MALMO_PLANNING_PROVIDER_KEY;
export const PLANNING_SOURCE_SLUG = MALMO_PLANNING_SOURCE_SLUG;
export const PLANNING_DATASET_LABEL = "Malmö stad — Gällande detaljplaner (SEPlan)";
export const PLANNING_SOURCE_ATTRIBUTION = "Malmö stad · Stadsbyggnadskontoret (SBK)";

/** Nearby screening distance (m) for nearest mapped plan when no intersection. */
export const PLANNING_NEARBY_M = 250;

export type NormalizedPlanningRecord = {
  planId: string;
  planName: string | null;
  /** Source terminology preserved (e.g. Gällande / Laga kraft date text). */
  planStatus: string | null;
  lmAkt: string | null;
  decisionDate: string | null;
  legalForceDate: string | null;
  sourceUrl: string | null;
  municipality: string;
  municipalityCode: string;
  providerKey: string;
  normalizeVersion: string;
};

function text(props: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const raw = props[key] ?? props[key.toLowerCase()] ?? props[key.toUpperCase()];
    if (raw == null) continue;
    const value = String(raw).trim();
    if (value.length > 0) return value;
  }
  return null;
}

/** Normalize Malmö SEPlan/Gallande_planer attributes. Preserve source labels. */
export function normalizeMalmoPlanRecord(props: Record<string, unknown>): NormalizedPlanningRecord {
  const planId =
    text(props, "PLAN_", "PLANID", "plan_", "planId") ??
    text(props, "LMAKT", "lmAkt") ??
    "unknown";
  const lagakraft = text(props, "LAGAKRAFT_", "FIX_LAGAKR", "lagakraft");
  const decisionDate = text(props, "BESLUTSDAT", "beslutsdat");
  // Malmö layer is "Gällande planer" — status is officially gällande; preserve date text when present.
  const planStatus = lagakraft && lagakraft !== " "
    ? `Gällande · laga kraft ${lagakraft}`
    : "Gällande";

  return {
    planId,
    planName: text(props, "PLANNAMN", "plannamn"),
    planStatus,
    lmAkt: text(props, "LMAKT", "lmakt"),
    decisionDate,
    legalForceDate: lagakraft && lagakraft.trim() ? lagakraft.trim() : null,
    sourceUrl: text(props, "url_dok", "url_1", "url_2", "url_ovrig"),
    municipality: "Malmö",
    municipalityCode: "1280",
    providerKey: MALMO_PLANNING_PROVIDER_KEY,
    normalizeVersion: PLANNING_NORMALIZE_VERSION,
  };
}

export function formatPlanningOverlapPct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return "not measured";
  if (pct <= 0) return "0%";
  if (pct < 0.5) return "<0.5%";
  return `${Math.round(pct)}%`;
}

export function formatPlanningNearestM(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return "not measured";
  if (meters <= 0) return "intersects footprint";
  if (meters < 1) return "<1 m";
  return `${Math.round(meters)} m`;
}

export function describePlanningEvidence(input: {
  queried?: boolean;
  intersectingCount?: number | null;
  overlapPct?: number | null;
  nearestM?: number | null;
  planIds?: string[] | null;
  planNames?: string[] | null;
  planStatuses?: string[] | null;
  municipality?: string | null;
  unavailable?: boolean;
}): string {
  if (input.queried !== true) {
    return "Official machine-readable planning data is not available or was not evaluated for this Candidate in NOXHEIM. This is not a finding that no plan exists.";
  }
  const intersecting = input.intersectingCount ?? 0;
  if (intersecting <= 0) {
    return "Official planning evidence was evaluated. No mapped detailed-plan geometry intersects this Candidate footprint in the integrated municipal dataset. This is not a finding of absent planning context or low planning risk.";
  }
  const parts: string[] = [];
  parts.push(
    `${intersecting} mapped detailed-plan polygon${intersecting === 1 ? "" : "s"} intersect${intersecting === 1 ? "s" : ""} the Candidate footprint`,
  );
  if (input.overlapPct != null && Number.isFinite(input.overlapPct)) {
    parts.push(`footprint overlap ${formatPlanningOverlapPct(input.overlapPct)}`);
  }
  const ids = (input.planIds ?? []).filter(Boolean).slice(0, 3);
  const names = (input.planNames ?? []).filter(Boolean).slice(0, 2);
  if (ids.length > 0) parts.push(`plan ID${ids.length === 1 ? "" : "s"}: ${ids.join(", ")}`);
  if (names.length > 0) parts.push(`name${names.length === 1 ? "" : "s"}: ${names.join("; ")}`);
  const statuses = (input.planStatuses ?? []).filter(Boolean).slice(0, 2);
  if (statuses.length > 0) parts.push(`status per source: ${statuses.join("; ")}`);
  if (input.municipality) parts.push(`municipality: ${input.municipality}`);
  return `${parts.join("; ")}. Official mapped planning geometry is context for further municipal review — not a permitting conclusion.`;
}
