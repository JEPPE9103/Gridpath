import type {
  AttentionReason,
  ProjectAttentionInput,
  ProjectAttentionLevel,
  ProjectAttentionResult,
} from "@/lib/intelligence/types";
import type { OverviewPipelineStage } from "@/lib/data/overview-types";
import type { ChecklistStatus } from "@/types";

const ADVANCED_STAGES: OverviewPipelineStage[] = [
  "Application",
  "Grid Study",
  "Offer",
  "Agreement",
  "Construction",
  "Energisation",
];

function isOverdueRequired(
  item: { required: boolean; status: ChecklistStatus; dueDate: string | null },
  today: Date,
): boolean {
  if (!item.required || item.status === "Complete" || !item.dueDate) {
    return false;
  }
  const due = new Date(`${item.dueDate}T00:00:00`);
  return due.getTime() < today.getTime();
}

function countOverdueRequired(
  requirements: ProjectAttentionInput["requirements"],
  today: Date,
): number {
  return requirements.filter((item) => isOverdueRequired(item, today)).length;
}

function countIncompleteRequired(requirements: ProjectAttentionInput["requirements"]): number {
  return requirements.filter(
    (item) => item.required && item.status !== "Complete",
  ).length;
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
    Boolean(input.targetCOD.trim())
  );
}

export function deriveProjectAttention(
  input: ProjectAttentionInput,
  today: Date = new Date(),
): ProjectAttentionResult {
  if (!hasWorkflowSignals(input)) {
    return {
      level: "insufficient_data",
      reasons: [],
      priorityScore: 0,
    };
  }

  const reasons: AttentionReason[] = [];
  let priorityScore = 0;

  const statusValue = caseStatusValue(input);
  const overdueRequired = countOverdueRequired(input.requirements, today);
  const incompleteRequired = countIncompleteRequired(input.requirements);
  const criticalAlerts = input.openAlertSeverities.filter((s) => s === "critical").length;
  const warningAlerts = input.openAlertSeverities.filter((s) => s === "warning").length;

  if (statusValue === "at_risk") {
    reasons.push({
      key: "case_at_risk",
      label: "Connection case is At Risk",
      severity: "high",
      sourceCategory: "your_team",
    });
    priorityScore = Math.max(priorityScore, 100);
  }

  if (statusValue === "overdue") {
    reasons.push({
      key: "case_overdue",
      label: "Connection case is Overdue",
      severity: "high",
      sourceCategory: "your_team",
    });
    priorityScore = Math.max(priorityScore, 95);
  }

  if (overdueRequired > 0) {
    reasons.push({
      key: "overdue_requirements",
      label:
        overdueRequired === 1
          ? "1 required action is overdue"
          : `${overdueRequired} required actions are overdue`,
      severity: "high",
      sourceCategory: "your_team",
    });
    priorityScore = Math.max(priorityScore, 90);
  }

  if (criticalAlerts > 0) {
    reasons.push({
      key: "critical_alerts",
      label:
        criticalAlerts === 1
          ? "1 open critical alert"
          : `${criticalAlerts} open critical alerts`,
      severity: "high",
      sourceCategory: "noxheim_derived",
    });
    priorityScore = Math.max(priorityScore, 85);
  }

  if (warningAlerts > 0) {
    reasons.push({
      key: "warning_alerts",
      label:
        warningAlerts === 1
          ? "1 open warning alert"
          : `${warningAlerts} open warning alerts`,
      severity: "high",
      sourceCategory: "noxheim_derived",
    });
    priorityScore = Math.max(priorityScore, 80);
  }

  if (statusValue === "waiting") {
    reasons.push({
      key: "case_waiting",
      label: "Connection case is Waiting",
      severity: "medium",
      sourceCategory: "your_team",
    });
    priorityScore = Math.max(priorityScore, 50);
  }

  if (incompleteRequired > 0 && overdueRequired === 0) {
    reasons.push({
      key: "incomplete_requirements",
      label:
        incompleteRequired === 1
          ? "1 required action remains"
          : `${incompleteRequired} required actions remain`,
      severity: "medium",
      sourceCategory: "your_team",
    });
    priorityScore = Math.max(priorityScore, 40);
  }

  if (
    !input.hasConnectionCase &&
    ADVANCED_STAGES.includes(input.stage)
  ) {
    reasons.push({
      key: "missing_connection_case",
      label: "No connection case has been created yet",
      detail: `Project is at ${input.stage} stage.`,
      severity: "medium",
      sourceCategory: "your_team",
    });
    priorityScore = Math.max(priorityScore, 35);
  }

  if (input.confidence === "Unknown") {
    reasons.push({
      key: "unknown_confidence",
      label: "Team confidence is Unknown",
      severity: "medium",
      sourceCategory: "your_team",
    });
    priorityScore = Math.max(priorityScore, 20);
  }

  if (!input.targetCOD.trim()) {
    reasons.push({
      key: "missing_target_cod",
      label: "Target COD is not set",
      severity: "medium",
      sourceCategory: "your_team",
    });
    priorityScore = Math.max(priorityScore, 15);
  }

  let level: ProjectAttentionLevel;
  if (priorityScore >= 80) {
    level = "needs_attention";
  } else if (priorityScore >= 15) {
    level = "watch";
  } else {
    level = "on_track";
  }

  return {
    level,
    reasons: sortReasons(reasons),
    priorityScore,
  };
}

function sortReasons(reasons: AttentionReason[]): AttentionReason[] {
  const rank: Record<AttentionReason["severity"], number> = {
    high: 0,
    medium: 1,
    low: 2,
  };
  return [...reasons].sort((a, b) => rank[a.severity] - rank[b.severity]);
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
