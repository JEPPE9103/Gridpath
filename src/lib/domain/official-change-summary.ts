import { NUP_FORECAST_TRANSFER_CAPACITY_NEED } from "@/lib/domain/grid-intelligence";
import type { ObservationChangeKind } from "@/lib/data/grid-changes-types";

export const NUP_FORECAST_NEED_CHANGE_DISCLAIMER =
  "Published forecast transfer-capacity need does not represent available connection capacity or grid headroom.";

export const OFFICIAL_CHANGE_UNKNOWN_SUMMARY =
  "An official source record changed. Review source details.";

export const GEOGRAPHIC_OVERLAP_EXPLANATION =
  "Project location overlaps the official planning area affected by this change. This is covering geography, not a connection point.";

const FORBIDDEN_CHANGE_TERMS = [
  "available grid capacity",
  "available mw",
  "connectable mw",
  "probability of connection",
  "capacity increased",
  "grid improved",
  "connection opportunity",
  "your project is impacted technically",
  "capacity has changed",
] as const;

export type OfficialChangeValueInput = {
  semantic?: string | null;
  year?: string | number | null;
  valueNumeric?: number | null;
  valueText?: string | null;
  unit?: string | null;
  display?: string | null;
};

export function canReviewOfficialChangeImpacts(role: string): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

export function isOfficialSourceUpdateDelayed(health: string): boolean {
  return health === "failed" || health === "stale";
}

export function officialSourceDelayMessage(delayedCount: number): string | null {
  if (delayedCount <= 0) {
    return null;
  }
  if (delayedCount === 1) {
    return "One supported official source is currently delayed.";
  }
  return `${delayedCount} supported official sources are currently delayed.`;
}

export function officialChangeCopyContainsForbiddenTerm(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of FORBIDDEN_CHANGE_TERMS) {
    if (lower.includes(term)) return term;
  }
  return null;
}

export function summarizeOfficialChange(input: {
  kind: ObservationChangeKind;
  semantic?: string | null;
  before?: OfficialChangeValueInput | null;
  after?: OfficialChangeValueInput | null;
}): string {
  const semantic = input.semantic?.trim() || input.after?.semantic || input.before?.semantic || null;
  const year = formatYear(input.after?.year ?? input.before?.year);
  const beforeDisplay = displayValue(input.before);
  const afterDisplay = displayValue(input.after);

  if (semantic === NUP_FORECAST_TRANSFER_CAPACITY_NEED) {
    if (input.kind === "changed" && beforeDisplay && afterDisplay) {
      return year
        ? `Forecast transfer-capacity need for ${year} changed from ${beforeDisplay} to ${afterDisplay}.`
        : `Forecast transfer-capacity need changed from ${beforeDisplay} to ${afterDisplay}.`;
    }
    if (input.kind === "added" && afterDisplay) {
      return year
        ? `Forecast transfer-capacity need for ${year} was added (${afterDisplay}).`
        : `Forecast transfer-capacity need was added (${afterDisplay}).`;
    }
    if (input.kind === "removed" && beforeDisplay) {
      return year
        ? `Forecast transfer-capacity need for ${year} was removed from the latest publication (previously ${beforeDisplay}).`
        : `Forecast transfer-capacity need was removed from the latest publication.`;
    }
  }

  if (looksLikeOperatorName(semantic) && input.kind === "changed" && beforeDisplay && afterDisplay) {
    return `Operator name changed from ${beforeDisplay} to ${afterDisplay}.`;
  }

  if (input.kind === "added") {
    return "Official planning-area record was added.";
  }
  if (input.kind === "removed") {
    return "Official record was removed from the latest publication.";
  }
  if (beforeDisplay && afterDisplay && beforeDisplay !== afterDisplay) {
    const field = semanticFieldName(semantic);
    return `Published value for ${field} changed from ${beforeDisplay} to ${afterDisplay}.`;
  }
  return OFFICIAL_CHANGE_UNKNOWN_SUMMARY;
}

export function paginateItems<T>(items: T[], page: number, pageSize: number): {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
} {
  const size = Math.max(1, pageSize);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * size;
  return {
    items: items.slice(start, start + size),
    page: safePage,
    pageCount,
    total,
  };
}

export function countOfficialChangeImpacts(
  rows: Array<{ reviewStatus: string; projectId: string | null }>,
): {
  unreviewed: number;
  confirmed: number;
  dismissed: number;
  unreviewedProjectCount: number;
} {
  const unreviewedProjects = new Set<string>();
  let unreviewed = 0;
  let confirmed = 0;
  let dismissed = 0;
  for (const row of rows) {
    if (row.reviewStatus === "confirmed") {
      confirmed += 1;
    } else if (row.reviewStatus === "dismissed") {
      dismissed += 1;
    } else {
      unreviewed += 1;
      if (row.projectId) unreviewedProjects.add(row.projectId);
    }
  }
  return {
    unreviewed,
    confirmed,
    dismissed,
    unreviewedProjectCount: unreviewedProjects.size,
  };
}

function displayValue(value: OfficialChangeValueInput | null | undefined): string | null {
  if (!value) return null;
  if (value.display?.trim()) return value.display.trim();
  if (value.valueNumeric != null && Number.isFinite(value.valueNumeric)) {
    const unit = value.unit?.trim() && value.unit !== "MW" ? value.unit.trim() : "MW";
    return `${value.valueNumeric} ${unit}`;
  }
  return value.valueText?.trim() || null;
}

function formatYear(value: string | number | null | undefined): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && /^\d{4}$/.test(value.trim())) return value.trim();
  return null;
}

function looksLikeOperatorName(semantic: string | null): boolean {
  return semantic === "official_operator_name" || semantic === "operator_name";
}

function semanticFieldName(semantic: string | null): string {
  if (!semantic) return "this field";
  return semantic.replaceAll("_", " ");
}
