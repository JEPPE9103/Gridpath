import type { OverviewPipelineStage } from "@/lib/data/overview-types";
import type { AlertSeverity, ChecklistStatus, Confidence } from "@/types";

export type ProjectAttentionLevel =
  | "needs_attention"
  | "watch"
  | "on_track"
  | "insufficient_data";

export type AttentionSeverity = "high" | "medium" | "low";

export type SourceCategory = "your_team" | "official_source" | "noxheim_derived";

export type AttentionReason = {
  key: string;
  label: string;
  detail?: string;
  severity: AttentionSeverity;
  sourceCategory: SourceCategory;
};

export type ProjectAttentionInput = {
  stage: OverviewPipelineStage;
  confidence: Confidence;
  targetCOD: string;
  connectionCaseStatus: string | null;
  connectionCaseStatusValue: string | null;
  hasConnectionCase: boolean;
  requirements: Array<{
    required: boolean;
    status: ChecklistStatus;
    dueDate: string | null;
  }>;
  openAlertSeverities: AlertSeverity[];
};

export type ProjectAttentionResult = {
  level: ProjectAttentionLevel;
  reasons: AttentionReason[];
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
  requirements: Array<{
    required: boolean;
    status: ChecklistStatus;
    dueDate: string | null;
  }>;
  openAlertSeverities: AlertSeverity[];
  lastUpdated: string;
};

export type PortfolioAttentionItem = {
  id: string;
  slug: string;
  name: string;
  level: "needs_attention" | "watch";
  summary: string;
  priorityScore: number;
  stage: OverviewPipelineStage;
};

export type PortfolioAttentionResult = {
  needsAttention: PortfolioAttentionItem[];
  watch: PortfolioAttentionItem[];
};
