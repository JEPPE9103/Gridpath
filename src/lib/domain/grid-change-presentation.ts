import {
  NUP_FORECAST_TRANSFER_CAPACITY_NEED,
  type ChangeMatchType,
  type ChangeReviewStatus,
  type ExternalChangeSeverity,
  type ExternalChangeType,
  type ObservationChangeKind,
} from "@/lib/domain/grid-intelligence";
import type { GridChangeValueView } from "@/lib/data/grid-changes-types";

const CHANGE_TYPE_LABELS: Record<ExternalChangeType, string> = {
  capacity: "Capacity",
  reinforcement: "Reinforcement",
  constraint: "Constraint",
  timeline: "Timeline",
  requirement: "Requirement",
  process: "Process",
  tariff: "Tariff",
  geography: "Geography",
  other: "Other",
};

const SEVERITY_LABELS: Record<ExternalChangeSeverity, string> = {
  info: "Info",
  positive: "Positive",
  warning: "Warning",
  critical: "Critical",
};

const MATCH_TYPE_LABELS: Record<ChangeMatchType, string> = {
  geographic: "Geographic",
  operator: "Operator",
  explicit: "Explicit",
  rule_based: "Rule-based",
};

const REVIEW_STATUS_LABELS: Record<ChangeReviewStatus, string> = {
  unreviewed: "Unreviewed",
  confirmed: "Confirmed",
  dismissed: "Dismissed",
};

const CHANGE_KIND_LABELS: Record<ObservationChangeKind, string> = {
  added: "New published information",
  removed: "Published information removed",
  changed: "Published information changed",
};

const SEMANTIC_LABELS: Record<string, string> = {
  [NUP_FORECAST_TRANSFER_CAPACITY_NEED]: "Forecast need for transfer capacity",
  overlying_network_limitation: "Overlying-network limitation",
  planned_investments_reported: "Planned investments",
  flexibility_need: "Flexibility need",
  planned_measures_meet_own_network_need: "Planned measures versus own-network need",
};

export function changeTypeLabel(value: string | null | undefined): string {
  if (!value) return "Other";
  return CHANGE_TYPE_LABELS[value as ExternalChangeType] ?? value.replaceAll("_", " ");
}

export function changeSeverityLabel(value: string | null | undefined): string {
  if (!value) return "Info";
  return SEVERITY_LABELS[value as ExternalChangeSeverity] ?? value;
}

export function matchTypeLabel(value: string | null | undefined): string {
  if (!value) return "Geographic";
  return MATCH_TYPE_LABELS[value as ChangeMatchType] ?? value.replaceAll("_", " ");
}

export function reviewStatusLabel(value: string | null | undefined): string {
  if (!value) return REVIEW_STATUS_LABELS.unreviewed;
  return REVIEW_STATUS_LABELS[value as ChangeReviewStatus] ?? value;
}

export function observationChangeKindLabel(kind: ObservationChangeKind): string {
  return CHANGE_KIND_LABELS[kind];
}

export function semanticFieldLabel(semantic: string | null | undefined): string {
  if (!semantic) {
    return "Published value";
  }
  if (semantic === NUP_FORECAST_TRANSFER_CAPACITY_NEED) {
    return SEMANTIC_LABELS[NUP_FORECAST_TRANSFER_CAPACITY_NEED];
  }
  return SEMANTIC_LABELS[semantic] ?? semantic.replaceAll("_", " ");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return value == null ? null : String(value);
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function observationChangeKindFromMetadata(
  metadata: Record<string, unknown>,
  beforeValue: Record<string, unknown> | null,
  afterValue: Record<string, unknown> | null,
): ObservationChangeKind {
  const kind = asString(metadata.change_kind);
  if (kind === "added" || kind === "removed" || kind === "changed") {
    return kind;
  }
  if (afterValue && !beforeValue) return "added";
  if (beforeValue && !afterValue) return "removed";
  return "changed";
}

export function observationValueView(
  payload: Record<string, unknown> | null,
): GridChangeValueView | null {
  if (!payload) {
    return null;
  }

  const semantic =
    asString(payload.semantic) ??
    asString(payload.semantic_label);
  const semanticLabel = semanticFieldLabel(semantic);
  const numeric =
    asFiniteNumber(payload.value_numeric) ??
    (typeof payload.value === "number" ? asFiniteNumber(payload.value) : null);
  const unit = asString(payload.unit);
  const text =
    asString(payload.value_text) ??
    (typeof payload.value === "string" ? asString(payload.value) : null);

  if (numeric != null) {
    const unitLabel = unit && unit !== "MW" ? unit : "MW";
    return {
      semanticLabel,
      display: `${numeric} ${unitLabel}`,
      empty: false,
      numeric: true,
    };
  }

  if (text) {
    return {
      semanticLabel,
      display: text,
      empty: false,
      numeric: false,
    };
  }

  return {
    semanticLabel,
    display: "—",
    empty: true,
    numeric: false,
  };
}

export function payloadRecord(value: unknown): Record<string, unknown> | null {
  return asRecord(value);
}

export function reviewSummaryLabel(statuses: ChangeReviewStatus[]): string {
  if (statuses.length === 0) {
    return "No matched projects";
  }
  const confirmed = statuses.filter((status) => status === "confirmed").length;
  const dismissed = statuses.filter((status) => status === "dismissed").length;
  const unreviewed = statuses.filter((status) => status === "unreviewed").length;
  if (unreviewed === statuses.length) return "Unreviewed";
  if (confirmed === statuses.length) return "Confirmed";
  if (dismissed === statuses.length) return "Dismissed";
  const parts: string[] = [];
  if (confirmed) parts.push(`${confirmed} confirmed`);
  if (dismissed) parts.push(`${dismissed} dismissed`);
  if (unreviewed) parts.push(`${unreviewed} unreviewed`);
  return parts.join(" · ");
}
