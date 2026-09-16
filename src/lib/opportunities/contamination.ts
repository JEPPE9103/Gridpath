/**
 * Environmental history / potentially contaminated-site screening (EBH).
 *
 * Official source: Länsstyrelserna EBH-stödet — Potentiellt förorenade områden.
 * Thresholds are NOXHEIM screening assumptions — not remediation design.
 * A registered record is NOT confirmed contamination of Candidate land.
 */

export const CONTAMINATION_NORMALIZE_VERSION = "contamination-normalize-v1";
export const CONTAMINATION_PROVIDER_KEY = "lst-ebh-potentiellt-fororenade";
export const CONTAMINATION_DATASET_LABEL =
  "Länsstyrelserna — Potentiellt förorenade områden (EBH)";
export const CONTAMINATION_SOURCE_ATTRIBUTION = "Länsstyrelserna / EBH-stödet";

/** Nearby screening distance (m). NOXHEIM screening assumption. */
export const CONTAMINATION_NEARBY_M = 180;
/** Secondary nearby band for Compare metrics (m). NOXHEIM screening assumption. */
export const CONTAMINATION_NEARBY_EXTENDED_M = 500;

export type ContaminationConstraintMode = "preference" | "hard";

export type NormalizedContaminationRecord = {
  ebhId: string;
  status: string | null;
  riskClass: string | null;
  primaryBranch: string | null;
  secondaryBranch: string | null;
  municipality: string | null;
  county: string | null;
  propertyCount: number | null;
  preciseStatus: string | null;
};

export function normalizeEbhRecord(props: Record<string, unknown>): NormalizedContaminationRecord {
  const text = (key: string) => {
    const raw = props[key] ?? props[key.toLowerCase()] ?? props[key.toUpperCase()];
    if (raw == null) return null;
    const value = String(raw).trim();
    return value.length > 0 ? value : null;
  };
  const num = (key: string) => {
    const raw = props[key] ?? props[key.toLowerCase()] ?? props[key.toUpperCase()];
    if (raw == null || raw === "") return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  };
  return {
    ebhId: text("EBH_ID") ?? text("ebh_id") ?? "unknown",
    status: text("STATUS"),
    riskClass: text("RISKKLASS"),
    primaryBranch: text("P_BRANSCH"),
    secondaryBranch: text("S_BRANSCH"),
    municipality: text("KOMMUN"),
    county: text("LAN"),
    propertyCount: num("FASTIGHET"),
    preciseStatus: text("PRECISERAD"),
  };
}

/** True when official RISKKLASS text indicates MIFO class 1 or 2. */
export function isHighOfficialRiskClass(riskClass: string | null | undefined): boolean {
  if (!riskClass) return false;
  const normalized = riskClass.toLowerCase().replace(/\s+/g, " ").trim();
  if (/^1\b/.test(normalized) || /\briskklass\s*1\b/.test(normalized)) return true;
  if (/^2\b/.test(normalized) || /\briskklass\s*2\b/.test(normalized)) return true;
  if (normalized.includes("mycket stor")) return true;
  if (normalized.includes("stor risk") && !normalized.includes("måttlig") && !normalized.includes("liten")) {
    return true;
  }
  return false;
}

export function formatContaminationNearestM(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return "not measured";
  if (meters <= 0) return "intersects footprint";
  if (meters < 1) return "<1 m";
  return `${Math.round(meters)} m`;
}

export function describeContaminationEvidence(input: {
  intersectingCount?: number | null;
  nearbyCount?: number | null;
  nearestM?: number | null;
  riskClasses?: string[] | null;
}): string {
  const intersecting = input.intersectingCount ?? 0;
  const nearby = input.nearbyCount ?? 0;
  const classes = (input.riskClasses ?? []).filter(Boolean);
  if (intersecting <= 0 && nearby <= 0) {
    return "No mapped official potentially contaminated-site record identified in the evaluated EBH dataset for this Candidate. This is not a finding that environmental history is absent.";
  }
  const parts: string[] = [];
  if (intersecting > 0) {
    parts.push(
      `${intersecting} official potentially contaminated-site record${intersecting === 1 ? "" : "s"} intersect${intersecting === 1 ? "s" : ""} the Candidate footprint`,
    );
  } else if (nearby > 0) {
    parts.push(
      `${nearby} official potentially contaminated-site record${nearby === 1 ? "" : "s"} within ${CONTAMINATION_NEARBY_M} m screening distance`,
    );
  }
  if (input.nearestM != null && Number.isFinite(input.nearestM)) {
    parts.push(`nearest ${formatContaminationNearestM(input.nearestM)}`);
  }
  if (classes.length > 0) {
    parts.push(`official classification: ${classes.slice(0, 3).join("; ")}`);
  }
  return `${parts.join("; ")}. Screening-level mapped environmental-history evidence — not a contamination confirmation or remediation finding.`;
}
