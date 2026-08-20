import type { DeadlineAttention } from "@/lib/domain/connection-deadlines";
import type { OverviewPipelineStage } from "@/lib/data/overview-types";
import type { ConnectionCaseStatus } from "@/types";

export type ConnectionCaseListStatus = ConnectionCaseStatus | "Complete" | "Cancelled";

export const CONNECTION_CASE_STATUS_FILTERS: ConnectionCaseListStatus[] = [
  "On Track",
  "Waiting",
  "At Risk",
  "Overdue",
  "Complete",
  "Cancelled",
];

export type ConnectionCaseListItem = {
  id: string;
  projectName: string;
  projectSlug: string;
  gridOperator: string;
  caseId: string | null;
  stage: OverviewPipelineStage;
  submittedAt: string | null;
  nextMilestone: string | null;
  deadline: string | null;
  ownerName: string | null;
  status: ConnectionCaseListStatus;
  notes: string | null;
  updatedAt: string;
  deadlineAttention: DeadlineAttention | null;
};

export type ConnectionCasesResult =
  | { kind: "ok"; cases: ConnectionCaseListItem[] }
  | { kind: "no_organization" }
  | { kind: "error"; message: string };

export function isActiveConnectionCase(status: ConnectionCaseListStatus): boolean {
  return status !== "Complete" && status !== "Cancelled";
}
