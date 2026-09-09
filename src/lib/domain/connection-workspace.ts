import { OVERVIEW_PIPELINE_STAGES, type OverviewPipelineStage } from "@/lib/data/overview-types";
import type {
  ProjectDocumentItem,
  ProjectEventItem,
  ProjectRequirementItem,
} from "@/lib/data/project-detail-types";
import { applicationReadinessFromRequirements } from "@/lib/domain/application-readiness";
import {
  deadlineAttention,
  deadlineRelativeLabel,
} from "@/lib/domain/connection-deadlines";
import { deriveProjectNextAction } from "@/lib/intelligence/project-attention";
import type { ProjectNextAction } from "@/lib/intelligence/types";
import { canWriteWorkflow } from "@/lib/projects/authorization";
import type { ChecklistStatus } from "@/types";

export const CONNECTION_READINESS_DISCLAIMER =
  "Readiness measures workflow completeness. It does not estimate connection probability, available grid capacity or technical feasibility.";

export const CONNECTION_TRACKING_DISCLAIMER =
  "NOXHEIM tracks the connection process you record. It does not submit applications to network operators.";

const FORBIDDEN_CONNECTION_TERMS = [
  "connection probability",
  "probability of connection",
  "available grid capacity",
  "technical feasibility",
  "connection score",
  "will this project get connected",
  "connection is likely",
  "submit application now",
  "proceed with investment",
] as const;

export type ConnectionRequirementGroup = "needs_attention" | "upcoming" | "complete" | "optional";

export type GroupedConnectionRequirement = ProjectRequirementItem & {
  group: ConnectionRequirementGroup;
  dueLabel: string | null;
  attention: ReturnType<typeof deadlineAttention>;
};

export type ConnectionRequirementGroups = {
  needsAttention: GroupedConnectionRequirement[];
  upcoming: GroupedConnectionRequirement[];
  complete: GroupedConnectionRequirement[];
  optional: GroupedConnectionRequirement[];
  outstandingRequiredCount: number;
  overdueRequiredCount: number;
  completeRequiredCount: number;
  requiredCount: number;
};

export type ConnectionNextAction = ProjectNextAction;

export type ConnectionStageJourney = {
  stages: OverviewPipelineStage[];
  current: OverviewPipelineStage;
  currentIndex: number;
  past: OverviewPipelineStage[];
  next: OverviewPipelineStage | null;
};

export type ConnectionEventKind = "stage" | "requirement" | "document" | "case" | "other";

export type ConnectionCaseLifecycle = "active" | "complete" | "cancelled";

export function connectionCopyContainsForbiddenTerm(text: string): string | null {
  const lower = text
    .replaceAll(CONNECTION_READINESS_DISCLAIMER, "")
    .replaceAll(CONNECTION_TRACKING_DISCLAIMER, "")
    .toLowerCase();
  for (const term of FORBIDDEN_CONNECTION_TERMS) {
    if (lower.includes(term)) return term;
  }
  return null;
}

export function canWriteConnectionWorkspace(role: string | null | undefined): boolean {
  return canWriteWorkflow(role);
}

export function connectionCaseLifecycle(statusValue: string | null | undefined): ConnectionCaseLifecycle {
  if (statusValue === "complete") return "complete";
  if (statusValue === "cancelled") return "cancelled";
  return "active";
}

export function groupConnectionRequirements(
  items: ProjectRequirementItem[],
  now = new Date(),
): ConnectionRequirementGroups {
  const grouped: GroupedConnectionRequirement[] = items.map((item) => {
    const attention = deadlineAttention(item.dueDate, now);
    const dueLabel = deadlineRelativeLabel(item.dueDate, now);
    let group: ConnectionRequirementGroup = "upcoming";
    if (!item.required) {
      group = item.status === "Complete" ? "complete" : "optional";
    } else if (item.status === "Complete") {
      group = "complete";
    } else if (attention === "overdue" || attention === "approaching") {
      group = "needs_attention";
    } else {
      group = "upcoming";
    }
    return { ...item, group, dueLabel, attention };
  });

  const rank = (item: GroupedConnectionRequirement) => {
    if (item.attention === "overdue") return 0;
    if (item.attention === "approaching") return 1;
    if (item.dueDate) return 2;
    return 3;
  };

  const needsAttention = grouped
    .filter((item) => item.group === "needs_attention")
    .sort((left, right) => rank(left) - rank(right) || left.label.localeCompare(right.label));
  const upcoming = grouped
    .filter((item) => item.group === "upcoming")
    .sort((left, right) => (left.dueDate ?? "9999").localeCompare(right.dueDate ?? "9999"));
  const complete = grouped.filter((item) => item.group === "complete");
  const optional = grouped.filter((item) => item.group === "optional");
  const readiness = applicationReadinessFromRequirements(items);

  return {
    needsAttention,
    upcoming,
    complete,
    optional,
    outstandingRequiredCount: Math.max(0, readiness.requiredCount - readiness.completeCount),
    overdueRequiredCount: needsAttention.filter((item) => item.attention === "overdue").length,
    completeRequiredCount: readiness.completeCount,
    requiredCount: readiness.requiredCount,
  };
}

export function connectionNextAction(input: {
  requirements: ProjectRequirementItem[];
  caseDeadline?: string | null;
  caseStatusValue?: string | null;
  nextMilestone?: string | null;
  unreviewedOfficialChangeCount?: number;
  projectSlug?: string;
  projectId?: string;
  now?: Date;
}): ConnectionNextAction {
  const now = input.now ?? new Date();
  return deriveProjectNextAction(
    {
      stage: "Application",
      confidence: "High",
      targetCOD: "set",
      connectionCaseStatus: null,
      connectionCaseStatusValue: input.caseStatusValue ?? "on_track",
      hasConnectionCase: true,
      requirements: input.requirements,
      openAlertSeverities: [],
      connectionDeadline: input.caseDeadline,
      nextMilestone: input.nextMilestone,
      unreviewedOfficialChangeCount: input.unreviewedOfficialChangeCount,
      projectSlug: input.projectSlug,
      projectId: input.projectId,
    },
    now,
  );
}

export function connectionStageJourney(
  current: OverviewPipelineStage | null | undefined,
): ConnectionStageJourney {
  const stages = [...OVERVIEW_PIPELINE_STAGES];
  const resolved = current && stages.includes(current) ? current : stages[0];
  const currentIndex = Math.max(0, stages.indexOf(resolved));
  return {
    stages,
    current: resolved,
    currentIndex,
    past: stages.slice(0, currentIndex),
    next: stages[currentIndex + 1] ?? null,
  };
}

export function classifyConnectionEvent(title: string): ConnectionEventKind {
  const lower = title.toLowerCase();
  if (lower.includes("stage")) return "stage";
  if (lower.includes("requirement")) return "requirement";
  if (lower.includes("document")) return "document";
  if (lower.includes("connection")) return "case";
  return "other";
}

export function connectionEventKindLabel(kind: ConnectionEventKind): string {
  switch (kind) {
    case "stage":
      return "Stage";
    case "requirement":
      return "Requirement";
    case "document":
      return "Document";
    case "case":
      return "Connection";
    default:
      return "Activity";
  }
}

export function latestActivityAt(events: ProjectEventItem[], fallback: string | null): string | null {
  return events[0]?.occurredAt ?? fallback;
}

export function recentProjectDocuments(
  documents: ProjectDocumentItem[],
  limit = 6,
): ProjectDocumentItem[] {
  return documents.slice(0, limit);
}

export function outstandingRequiredLabels(items: ProjectRequirementItem[]): string[] {
  return items
    .filter((item) => item.required && item.status !== "Complete")
    .map((item) => item.label);
}

export function isRequirementComplete(status: ChecklistStatus): boolean {
  return status === "Complete";
}
