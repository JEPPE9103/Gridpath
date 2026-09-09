/**
 * Canonical project attention model (NOXHEIM-derived, not official grid advice).
 *
 * Bands:
 * - action — overdue required items or overdue connection deadlines (and existing
 *   customer-entered At Risk / Overdue case status, or open critical/warning alerts)
 * - attention — due soon (7 days), unreviewed official changes
 * - review — completeness / hygiene signals only
 * - clear — no current attention signals
 *
 * Levels (`needs_attention` / `watch`) remain the Overview KPI mapping:
 * action → needs_attention; attention/review → watch.
 *
 * This does not estimate connection feasibility, available grid capacity, or probability.
 */
import { deadlineDayDelta, deadlineRelativeLabel } from "@/lib/domain/connection-deadlines";
import type { OverviewPipelineStage } from "@/lib/data/overview-types";
import type {
  AttentionBand,
  AttentionReason,
  AttentionRequirement,
  AttentionEvent,
  ProjectAttentionInput,
  ProjectAttentionLevel,
  ProjectAttentionResult,
  ProjectAttentionSignal,
  ProjectNextAction,
} from "@/lib/intelligence/types";

export const ATTENTION_DUE_SOON_DAYS = 7;
export const ATTENTION_INACTIVITY_REVIEW_DAYS = 30;

const ADVANCED_STAGES: OverviewPipelineStage[] = [
  "Application",
  "Grid Study",
  "Offer",
  "Agreement",
  "Construction",
  "Energisation",
];

function isActiveCase(statusValue: string | null): boolean {
  return statusValue !== "complete" && statusValue !== "cancelled";
}

function caseStatusValue(input: ProjectAttentionInput): string | null {
  return input.connectionCaseStatusValue ?? normalizeCaseStatus(input.connectionCaseStatus);
}

function normalizeCaseStatus(status: string | null): string | null {
  if (!status) {
    return null;
  }
  return status.trim().toLowerCase().replace(/\s+/g, "_");
}

function hasWorkflowSignals(input: ProjectAttentionInput): boolean {
  return (
    input.hasConnectionCase ||
    input.requirements.length > 0 ||
    input.openAlertSeverities.length > 0 ||
    Boolean(input.targetCOD.trim()) ||
    (input.unreviewedOfficialChangeCount ?? 0) > 0 ||
    Boolean(input.events && input.events.length > 0) ||
    input.unmatchedOfficialGeography === true
  );
}

function isIncompleteRequired(item: AttentionRequirement): boolean {
  return item.required && item.status !== "Complete";
}

function requirementHref(input: ProjectAttentionInput, item: AttentionRequirement): string | undefined {
  if (!input.projectSlug) {
    return undefined;
  }
  const anchor = item.id ? `#requirement-${item.id}` : "#connection-requirements";
  return `/projects/${input.projectSlug}/connection${anchor}`;
}

function connectionHref(input: ProjectAttentionInput): string | undefined {
  if (!input.projectSlug) {
    return undefined;
  }
  return `/projects/${input.projectSlug}/connection`;
}

function changesHref(input: ProjectAttentionInput): string | undefined {
  if (input.projectId) {
    return `/changes?project=${encodeURIComponent(input.projectId)}`;
  }
  if (input.projectSlug) {
    return `/projects/${input.projectSlug}`;
  }
  return "/changes";
}

function pickEarliestDue(items: AttentionRequirement[]): AttentionRequirement | null {
  const dated = items
    .filter((item) => item.dueDate)
    .sort((left, right) => (left.dueDate ?? "").localeCompare(right.dueDate ?? ""));
  return dated[0] ?? items[0] ?? null;
}

function requirementName(item: AttentionRequirement | null | undefined): string {
  const label = item?.label?.trim();
  return label || "Required item";
}

function dayWord(count: number): string {
  return count === 1 ? "day" : "days";
}

export function calendarDaysSince(iso: string, now: Date): number | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThen = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((startNow.getTime() - startThen.getTime()) / 86_400_000);
}

export function deriveDaysInCurrentStage(
  input: {
    events?: AttentionEvent[];
    connectionCaseCreatedAt?: string | null;
    hasConnectionCase?: boolean;
  },
  now: Date = new Date(),
): { days: number | null; source: ProjectAttentionResult["daysInCurrentStageSource"] } {
  if (!input.hasConnectionCase) {
    return { days: null, source: "unavailable" };
  }
  const stageEvent = (input.events ?? []).find((event) => event.title.toLowerCase().includes("stage"));
  if (stageEvent) {
    const days = calendarDaysSince(stageEvent.occurredAt, now);
    return days == null ? { days: null, source: "unavailable" } : { days: Math.max(0, days), source: "stage_event" };
  }
  if (input.connectionCaseCreatedAt) {
    const days = calendarDaysSince(input.connectionCaseCreatedAt, now);
    return days == null
      ? { days: null, source: "unavailable" }
      : { days: Math.max(0, days), source: "case_created" };
  }
  return { days: null, source: "unavailable" };
}

export function daysInCurrentStageLabel(days: number | null): string {
  if (days == null) {
    return "Duration unavailable";
  }
  return `${days} ${dayWord(days)} in current stage`;
}

export function lastActivityLabel(lastActivityAt: string | null, now: Date = new Date()): string {
  if (!lastActivityAt) {
    return "No recorded activity yet";
  }
  const days = calendarDaysSince(lastActivityAt, now);
  if (days == null) {
    return "No recorded activity yet";
  }
  if (days <= 0) {
    return "Last activity today";
  }
  return `Last activity ${days} ${dayWord(days)} ago`;
}

export function deriveLastActivityAt(input: {
  events?: AttentionEvent[];
  lastActivityAt?: string | null;
}): string | null {
  if (input.lastActivityAt) {
    return input.lastActivityAt;
  }
  return input.events?.[0]?.occurredAt ?? null;
}

function reasonFromSignal(signal: ProjectAttentionSignal): AttentionReason {
  const sourceCategory: AttentionReason["sourceCategory"] =
    signal.source === "official_change"
      ? "official_source"
      : signal.source === "activity"
        ? "noxheim_derived"
        : signal.source === "project" && signal.type.endsWith("_alerts")
          ? "noxheim_derived"
          : signal.source === "project" && signal.type === "unmatched_geography"
            ? "official_source"
            : "your_team";
  return {
    key: signal.type,
    label: signal.title,
    detail: signal.detail,
    severity: signal.severity === "action" ? "high" : signal.severity === "attention" ? "medium" : "low",
    sourceCategory,
  };
}

export function deriveProjectNextAction(
  input: ProjectAttentionInput,
  today: Date = new Date(),
): ProjectNextAction {
  const statusValue = caseStatusValue(input);
  const active = input.hasConnectionCase && isActiveCase(statusValue);
  const incomplete = input.requirements.filter(isIncompleteRequired);
  const overdue = incomplete.filter((item) => {
    const days = deadlineDayDelta(item.dueDate, today);
    return days != null && days < 0;
  });
  const dueSoon = incomplete.filter((item) => {
    const days = deadlineDayDelta(item.dueDate, today);
    return days != null && days >= 0 && days <= ATTENTION_DUE_SOON_DAYS;
  });
  const incompleteWithoutDeadline = incomplete.filter((item) => !item.dueDate);

  const earliestOverdue = pickEarliestDue(overdue);
  if (earliestOverdue) {
    return {
      kind: "overdue_requirement",
      title: `Complete ${requirementName(earliestOverdue)}`,
      detail: deadlineRelativeLabel(earliestOverdue.dueDate, today) ?? "Required item overdue",
      href: requirementHref(input, earliestOverdue),
    };
  }

  const earliestDueSoon = pickEarliestDue(dueSoon);
  if (earliestDueSoon) {
    return {
      kind: "due_soon_requirement",
      title: `Complete ${requirementName(earliestDueSoon)}`,
      detail: deadlineRelativeLabel(earliestDueSoon.dueDate, today) ?? "Required item due soon",
      href: requirementHref(input, earliestDueSoon),
    };
  }

  const caseDays = active ? deadlineDayDelta(input.connectionDeadline, today) : null;
  if (caseDays != null && caseDays < 0) {
    return {
      kind: "connection_deadline_overdue",
      title: "Update the connection deadline",
      detail: deadlineRelativeLabel(input.connectionDeadline, today) ?? "Connection deadline overdue",
      href: connectionHref(input),
    };
  }
  if (caseDays != null && caseDays <= ATTENTION_DUE_SOON_DAYS) {
    return {
      kind: "connection_deadline_due_soon",
      title: "Prepare for the connection deadline",
      detail: deadlineRelativeLabel(input.connectionDeadline, today) ?? "Connection deadline due soon",
      href: connectionHref(input),
    };
  }

  const unreviewed = input.unreviewedOfficialChangeCount ?? 0;
  if (unreviewed > 0) {
    return {
      kind: "official_change",
      title: "Review official Ei publication change",
      detail:
        unreviewed === 1
          ? "1 official publication change is waiting for team review."
          : `${unreviewed} official publication changes are waiting for team review.`,
      href: changesHref(input),
    };
  }

  const nextIncomplete = pickEarliestDue(incompleteWithoutDeadline) ?? pickEarliestDue(incomplete);
  if (nextIncomplete) {
    return {
      kind: "incomplete_requirement",
      title: `Complete ${requirementName(nextIncomplete)}`,
      detail: nextIncomplete.dueDate
        ? (deadlineRelativeLabel(nextIncomplete.dueDate, today) ?? "Required item still outstanding")
        : "Required item still outstanding",
      href: requirementHref(input, nextIncomplete),
    };
  }

  if (active && input.nextMilestone !== undefined && !(input.nextMilestone ?? "").trim()) {
    return {
      kind: "missing_milestone",
      title: "Set the next connection milestone",
      detail: "The active connection case has no next milestone recorded.",
      href: connectionHref(input),
    };
  }

  return {
    kind: "none",
    title: "No immediate action identified",
    detail: "NOXHEIM has not identified an overdue item, upcoming deadline, or unreviewed official change.",
  };
}

function buildSignals(input: ProjectAttentionInput, today: Date): ProjectAttentionSignal[] {
  const signals: ProjectAttentionSignal[] = [];
  const statusValue = caseStatusValue(input);
  const active = input.hasConnectionCase && isActiveCase(statusValue);
  const incomplete = input.requirements.filter(isIncompleteRequired);
  const overdue = incomplete.filter((item) => {
    const days = deadlineDayDelta(item.dueDate, today);
    return days != null && days < 0;
  });
  const dueSoon = incomplete.filter((item) => {
    const days = deadlineDayDelta(item.dueDate, today);
    return days != null && days >= 0 && days <= ATTENTION_DUE_SOON_DAYS;
  });

  if (statusValue === "at_risk") {
    signals.push({
      type: "case_at_risk",
      severity: "action",
      title: "Connection case is At Risk",
      detail: "Customer-entered connection case status.",
      source: "connection",
      href: connectionHref(input),
    });
  }

  if (statusValue === "overdue") {
    signals.push({
      type: "case_overdue",
      severity: "action",
      title: "Connection case is Overdue",
      detail: "Customer-entered connection case status.",
      source: "connection",
      href: connectionHref(input),
    });
  }

  const earliestOverdue = pickEarliestDue(overdue);
  if (earliestOverdue) {
    const days = Math.abs(deadlineDayDelta(earliestOverdue.dueDate, today) ?? 0);
    const extra = overdue.length > 1 ? ` ${overdue.length} required items are overdue.` : "";
    signals.push({
      type: "overdue_requirements",
      severity: "action",
      title: "Required item overdue",
      detail: `${requirementName(earliestOverdue)} was due ${days} ${dayWord(days)} ago.${extra}`,
      dueAt: earliestOverdue.dueDate,
      source: "requirement",
      href: requirementHref(input, earliestOverdue),
    });
  }

  const criticalAlerts = input.openAlertSeverities.filter((value) => value === "critical").length;
  const warningAlerts = input.openAlertSeverities.filter((value) => value === "warning").length;
  if (criticalAlerts > 0) {
    signals.push({
      type: "critical_alerts",
      severity: "action",
      title: criticalAlerts === 1 ? "1 open critical alert" : `${criticalAlerts} open critical alerts`,
      source: "project",
      href: input.projectSlug ? `/projects/${input.projectSlug}` : undefined,
    });
  }
  if (warningAlerts > 0) {
    signals.push({
      type: "warning_alerts",
      severity: "action",
      title: warningAlerts === 1 ? "1 open warning alert" : `${warningAlerts} open warning alerts`,
      source: "project",
      href: input.projectSlug ? `/projects/${input.projectSlug}` : undefined,
    });
  }

  const caseDays = active ? deadlineDayDelta(input.connectionDeadline, today) : null;
  if (caseDays != null && caseDays < 0) {
    const overdueDays = Math.abs(caseDays);
    signals.push({
      type: "connection_deadline_overdue",
      severity: "action",
      title: "Connection deadline overdue",
      detail: `The current connection deadline passed ${overdueDays} ${dayWord(overdueDays)} ago.`,
      dueAt: input.connectionDeadline,
      source: "connection",
      href: connectionHref(input),
    });
  }

  const earliestDueSoon = pickEarliestDue(dueSoon);
  if (earliestDueSoon) {
    const days = deadlineDayDelta(earliestDueSoon.dueDate, today) ?? 0;
    const extra = dueSoon.length > 1 ? ` ${dueSoon.length} required items are due within ${ATTENTION_DUE_SOON_DAYS} days.` : "";
    signals.push({
      type: "required_due_soon",
      severity: "attention",
      title: "Required item due soon",
      detail:
        days === 0
          ? `${requirementName(earliestDueSoon)} is due today.${extra}`
          : `${requirementName(earliestDueSoon)} is due in ${days} ${dayWord(days)}.${extra}`,
      dueAt: earliestDueSoon.dueDate,
      source: "requirement",
      href: requirementHref(input, earliestDueSoon),
    });
  }

  if (caseDays != null && caseDays >= 0 && caseDays <= ATTENTION_DUE_SOON_DAYS) {
    signals.push({
      type: "connection_deadline_due_soon",
      severity: "attention",
      title: "Connection milestone approaching",
      detail: input.connectionDeadline
        ? `Connection deadline ${input.connectionDeadline}.`
        : "Connection deadline is due within 7 days.",
      dueAt: input.connectionDeadline,
      source: "connection",
      href: connectionHref(input),
    });
  }

  const unreviewed = input.unreviewedOfficialChangeCount ?? 0;
  if (unreviewed > 0) {
    signals.push({
      type: "unreviewed_official_changes",
      severity: "attention",
      title: "Official change awaiting review",
      detail:
        unreviewed === 1
          ? "1 official publication change is waiting for team review. Review is team relevance, not a technical impact verdict."
          : `${unreviewed} official publication changes are waiting for team review. Review is team relevance, not a technical impact verdict.`,
      source: "official_change",
      href: changesHref(input),
    });
  }

  if (statusValue === "waiting") {
    signals.push({
      type: "case_waiting",
      severity: "review",
      title: "Connection case is Waiting",
      detail: "Customer-entered connection case status.",
      source: "connection",
      href: connectionHref(input),
    });
  }

  if (incomplete.length > 0 && overdue.length === 0 && dueSoon.length === 0) {
    signals.push({
      type: "incomplete_requirements",
      severity: "review",
      title:
        incomplete.length === 1
          ? "1 required action remains"
          : `${incomplete.length} required actions remain`,
      source: "requirement",
      href: connectionHref(input),
    });
  }

  if (!input.hasConnectionCase && ADVANCED_STAGES.includes(input.stage)) {
    signals.push({
      type: "missing_connection_case",
      severity: "review",
      title: "No connection case has been created yet",
      detail: `Project is at ${input.stage} stage.`,
      source: "connection",
    });
  }

  if (active && input.nextMilestone !== undefined && !(input.nextMilestone ?? "").trim()) {
    signals.push({
      type: "no_next_milestone",
      severity: "review",
      title: "No next milestone recorded",
      detail: "The active connection case has no next milestone.",
      source: "connection",
      href: connectionHref(input),
    });
  }

  if (active && input.connectionCaseOwnerAssigned === false) {
    signals.push({
      type: "no_owner",
      severity: "review",
      title: "No project owner assigned",
      detail: "The active connection case has no owner assigned.",
      source: "project",
      href: connectionHref(input),
    });
  }

  if (input.hasConnectionCase && input.nextMilestone !== undefined && input.requirements.filter((item) => item.required).length === 0) {
    signals.push({
      type: "no_required_items",
      severity: "review",
      title: "No required workflow items defined",
      source: "requirement",
      href: connectionHref(input),
    });
  }

  if (input.unmatchedOfficialGeography === true) {
    signals.push({
      type: "unmatched_geography",
      severity: "review",
      title: "Official grid geography needs review",
      detail: "NOXHEIM did not find a covering official area for this project location.",
      source: "project",
      href: input.projectSlug ? `/projects/${input.projectSlug}?tab=grid` : undefined,
    });
  }

  if (hasWorkflowSignals(input) && input.confidence === "Unknown") {
    signals.push({
      type: "unknown_confidence",
      severity: "review",
      title: "Team confidence is Unknown",
      source: "project",
    });
  }

  if (hasWorkflowSignals(input) && !input.targetCOD.trim()) {
    signals.push({
      type: "missing_target_cod",
      severity: "review",
      title: "Target COD is not set",
      source: "project",
    });
  }

  const lastActivityAt = deriveLastActivityAt(input);
  if (lastActivityAt) {
    const inactiveDays = calendarDaysSince(lastActivityAt, today);
    if (inactiveDays != null && inactiveDays >= ATTENTION_INACTIVITY_REVIEW_DAYS) {
      signals.push({
        type: "inactive_30d",
        severity: "review",
        title: "No recorded project activity in 30 days",
        detail: lastActivityLabel(lastActivityAt, today),
        source: "activity",
      });
    }
  }

  return signals;
}

function bandFromSignals(signals: ProjectAttentionSignal[]): AttentionBand {
  if (signals.some((signal) => signal.severity === "action")) {
    return "action";
  }
  if (signals.some((signal) => signal.severity === "attention")) {
    return "attention";
  }
  if (signals.some((signal) => signal.severity === "review")) {
    return "review";
  }
  return "clear";
}

function levelFromBand(band: AttentionBand, hasSignals: boolean): ProjectAttentionLevel {
  if (band === "action") {
    return "needs_attention";
  }
  if (band === "attention" || band === "review") {
    return "watch";
  }
  return hasSignals ? "on_track" : "insufficient_data";
}

function scoreFromBand(band: AttentionBand): number {
  switch (band) {
    case "action":
      return 90;
    case "attention":
      return 40;
    case "review":
      return 20;
    default:
      return 0;
  }
}

const SORT_TYPE_RANK: Record<string, number> = {
  overdue_requirements: 0,
  connection_deadline_overdue: 1,
  case_overdue: 1,
  case_at_risk: 2,
  critical_alerts: 2,
  warning_alerts: 2,
  required_due_soon: 3,
  connection_deadline_due_soon: 4,
  unreviewed_official_changes: 5,
};

export function attentionSortRank(result: Pick<ProjectAttentionResult, "band" | "signals">): number {
  if (result.band === "clear") {
    return 80;
  }
  const types = result.signals.map((signal) => signal.type);
  const actionCount = result.signals.filter((signal) => signal.severity === "action").length;
  const specific = types
    .map((type) => SORT_TYPE_RANK[type])
    .filter((value): value is number => value != null)
    .sort((left, right) => left - right)[0];
  if (specific != null && specific <= 1) {
    return specific;
  }
  if (actionCount > 1) {
    return 2;
  }
  if (specific != null) {
    return specific;
  }
  if (result.band === "review") {
    return 6;
  }
  return 5;
}

export function earliestSignalDueAt(signals: ProjectAttentionSignal[]): string | null {
  const dated = signals
    .map((signal) => signal.dueAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  return dated[0] ?? null;
}

export function deriveProjectAttention(
  input: ProjectAttentionInput,
  today: Date = new Date(),
): ProjectAttentionResult {
  const signals = buildSignals(input, today);
  const band = bandFromSignals(signals);
  const hasSignals = hasWorkflowSignals(input);
  const stage = deriveDaysInCurrentStage(
    {
      events: input.events,
      connectionCaseCreatedAt: input.connectionCaseCreatedAt,
      hasConnectionCase: input.hasConnectionCase,
    },
    today,
  );
  const lastActivityAt = deriveLastActivityAt(input);
  const nextAction = deriveProjectNextAction(input, today);

  if (!hasSignals && band === "clear") {
    return {
      level: "insufficient_data",
      band: "clear",
      reasons: [],
      signals: [],
      nextAction,
      daysInCurrentStage: stage.days,
      daysInCurrentStageSource: stage.source,
      lastActivityAt,
      priorityScore: 0,
    };
  }

  return {
    level: levelFromBand(band, hasSignals),
    band,
    reasons: signals.map(reasonFromSignal),
    signals,
    nextAction,
    daysInCurrentStage: stage.days,
    daysInCurrentStageSource: stage.source,
    lastActivityAt,
    priorityScore: scoreFromBand(band),
  };
}

export function attentionLevelLabel(level: ProjectAttentionLevel): string {
  switch (level) {
    case "needs_attention":
      return "Needs Attention";
    case "watch":
      return "Watch";
    case "on_track":
      return "On Track";
    case "insufficient_data":
      return "Limited Data";
  }
}

export function attentionBandLabel(band: AttentionBand): string {
  switch (band) {
    case "action":
      return "Action required";
    case "attention":
      return "Needs attention";
    case "review":
      return "Review";
    case "clear":
      return "No immediate action";
  }
}

const FORBIDDEN_ATTENTION_TERMS = [
  "risk score",
  "failure risk",
  "connection probability",
  "chance of connection",
  "feasibility score",
  "project success probability",
  "available capacity",
  "available grid capacity",
  "headroom",
  "connectable mw",
  "ai prediction",
  "ai recommendation",
  "real-time grid monitoring",
  "no grid available",
  "project stalled",
];

export function attentionCopyContainsForbiddenTerm(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of FORBIDDEN_ATTENTION_TERMS) {
    if (lower.includes(term)) {
      return term;
    }
  }
  return null;
}
