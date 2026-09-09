export type {
  AttentionBand,
  AttentionReason,
  AttentionSeverity,
  DevelopmentBriefInput,
  DevelopmentBriefSummary,
  OfficialContextSummary,
  PortfolioAttentionItem,
  PortfolioAttentionProjectInput,
  PortfolioAttentionResult,
  ProjectAttentionInput,
  ProjectAttentionLevel,
  ProjectAttentionResult,
  ProjectAttentionSignal,
  ProjectNextAction,
  SourceCategory,
} from "@/lib/intelligence/types";

export {
  ATTENTION_DUE_SOON_DAYS,
  attentionBandLabel,
  attentionCopyContainsForbiddenTerm,
  attentionLevelLabel,
  calendarDaysSince,
  daysInCurrentStageLabel,
  deriveDaysInCurrentStage,
  deriveLastActivityAt,
  deriveProjectAttention,
  deriveProjectNextAction,
  lastActivityLabel,
} from "@/lib/intelligence/project-attention";

export {
  buildDevelopmentBriefSummary,
  formatWorkflowReadinessLabel,
} from "@/lib/intelligence/development-brief";

export {
  buildPortfolioAttention,
  countNeedsAttentionProjects,
  EMPTY_PORTFOLIO_ATTENTION,
  matchesPortfolioAttentionFilter,
  portfolioAttentionCounts,
  projectIdsNeedingAttention,
} from "@/lib/intelligence/portfolio-attention";

export {
  pickLatestRetrievedDate,
  summarizeOfficialContext,
} from "@/lib/intelligence/official-context";

export {
  buildDevelopmentProfileExplanation,
  type CompareExplanationOptions,
} from "@/lib/intelligence/compare-explanation";
