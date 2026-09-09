import type { OverviewPipelineStage } from "@/lib/data/overview-types";
import type { AlertSeverity, ChecklistStatus, Confidence } from "@/types";

export type ProjectAttentionLevel =
  | "needs_attention"
  | "watch"
  | "on_track"
  | "insufficient_data";

export type AttentionBand = "action" | "attention" | "review" | "clear";

export type AttentionSignalSeverity = "action" | "attention" | "review";

export type AttentionSignalSource =
  | "requirement"
  | "connection"
  | "official_change"
  | "project"
  | "activity";

export type AttentionSeverity = "high" | "medium" | "low";

export type SourceCategory = "your_team" | "official_source" | "noxheim_derived";

export type AttentionReason = {
  key: string;
  label: string;
  detail?: string;
  severity: AttentionSeverity;
  sourceCategory: SourceCategory;
};

export type AttentionRequirement = {
  id?: string;
  label?: string;
  required: boolean;
  status: ChecklistStatus;
  dueDate: string | null;
};

export type AttentionEvent = {
  title: string;
  occurredAt: string;
};

export type ProjectAttentionSignal = {
  type: string;
  severity: AttentionSignalSeverity;
  title: string;
  detail?: string;
  dueAt?: string | null;
  source: AttentionSignalSource;
  href?: string;
};

export type ProjectNextAction = {
  kind:
    | "overdue_requirement"
    | "due_soon_requirement"
    | "connection_deadline_overdue"
    | "connection_deadline_due_soon"
    | "official_change"
    | "incomplete_requirement"
    | "missing_milestone"
    | "none";
  title: string;
  detail: string;
  href?: string;
};

export type ProjectAttentionInput = {
  stage: OverviewPipelineStage;
  confidence: Confidence;
  targetCOD: string;
  connectionCaseStatus: string | null;
  connectionCaseStatusValue: string | null;
  hasConnectionCase: boolean;
  requirements: AttentionRequirement[];
  openAlertSeverities: AlertSeverity[];
  unreviewedOfficialChangeCount?: number;
  connectionDeadline?: string | null;
  nextMilestone?: string | null;
  connectionCaseCreatedAt?: string | null;
  connectionCaseOwnerAssigned?: boolean | null;
  events?: AttentionEvent[];
  lastActivityAt?: string | null;
  unmatchedOfficialGeography?: boolean;
  projectSlug?: string;
  projectId?: string;
};

export type ProjectAttentionResult = {
  level: ProjectAttentionLevel;
  band: AttentionBand;
  reasons: AttentionReason[];
  signals: ProjectAttentionSignal[];
  nextAction: ProjectNextAction;
  daysInCurrentStage: number | null;
  daysInCurrentStageSource: "stage_event" | "case_created" | "unavailable";
  lastActivityAt: string | null;
  priorityScore: number;
};

export type OfficialContextSummary = {
  localNetworkAvailable: boolean;
  nupAvailable: boolean;
  latestRetrievedAt: string | null;
};

export type DevelopmentBriefInput = {
  name: string;
  technology: string;
  exportMW: number;
  importMW: number;
  stage: OverviewPipelineStage;
  targetCOD: string;
  connectionCase: {
    caseId: string | null;
    stage: OverviewPipelineStage;
    status: string;
  } | null;
  readinessPercent: number | null;
  readinessCompleteCount: number;
  readinessRequiredCount: number;
  officialContext: OfficialContextSummary;
  attention: ProjectAttentionResult;
  recentEvents: Array<{ title: string; occurredAt: string }>;
};

export type DevelopmentBriefSummary = {
  statusLabel: string;
  statusLevel: ProjectAttentionLevel;
  headline: string;
  attentionReasons: AttentionReason[];
};

export type PortfolioAttentionProjectInput = {
  id: string;
  slug: string;
  name: string;
  stage: OverviewPipelineStage;
  connectionCaseStatus: string | null;
  connectionCaseStatusValue: string | null;
  hasConnectionCase: boolean;
  readinessPercent: number | null;
  readinessCompleteCount: number;
  readinessRequiredCount: number;
  confidence: Confidence;
  targetCOD: string;
  requirements: AttentionRequirement[];
  openAlertSeverities: AlertSeverity[];
  unreviewedOfficialChangeCount?: number;
  lastUpdated: string;
  connectionDeadline?: string | null;
  nextMilestone?: string | null;
  connectionCaseCreatedAt?: string | null;
  connectionCaseOwnerAssigned?: boolean | null;
  events?: AttentionEvent[];
  lastActivityAt?: string | null;
  unmatchedOfficialGeography?: boolean;
};

export type PortfolioAttentionItem = {
  id: string;
  slug: string;
  name: string;
  level: "needs_attention" | "watch";
  band: "action" | "attention" | "review";
  summary: string;
  priorityScore: number;
  stage: OverviewPipelineStage;
  daysInCurrentStage: number | null;
  lastActivityAt: string | null;
  nextAction: ProjectNextAction;
  signals: ProjectAttentionSignal[];
};

export type PortfolioAttentionResult = {
  needsAttention: PortfolioAttentionItem[];
  watch: PortfolioAttentionItem[];
  prioritized: PortfolioAttentionItem[];
  actionRequiredCount: number;
  upcomingCount: number;
  reviewCount: number;
};
