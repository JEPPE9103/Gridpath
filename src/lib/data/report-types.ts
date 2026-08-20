import type { DeadlineAttention } from "@/lib/domain/connection-deadlines";
import type { OverviewPipelineStage } from "@/lib/data/overview-types";
import type { Confidence, Outlook, Technology } from "@/types";

export type ReportNamedCount = {
  label: string;
  count: number;
};

export type ReportOperatorMW = {
  operator: string;
  mw: number;
  count: number;
};

export type ReportTechnologyMix = {
  technology: string;
  count: number;
  mw: number;
};

export type ReportConnectionHealth = {
  onTrack: number;
  waiting: number;
  atRisk: number;
  overdue: number;
  upcomingDeadlines: number;
};

export type ReportReadinessBuckets = {
  averagePercent: number | null;
  atLeast80: number;
  from50to79: number;
  below50: number;
  notAvailable: number;
  scoredCount: number;
};

export type ReportAttentionProject = {
  slug: string;
  name: string;
  stage: OverviewPipelineStage;
  outlook: Outlook;
  readinessPercent: number | null;
  openCriticalAlerts: number;
  openWarningAlerts: number;
  connectionStatus: string | null;
  nextMilestone: string | null;
  deadline: string | null;
  deadlineAttention: DeadlineAttention | null;
};

export type ReportDocumentHealth = {
  complete: number;
  inProgress: number;
  draft: number;
  missing: number;
  total: number;
};

export type ReportOperationalMetrics = {
  projectsMonitored: number;
  openIssues: number;
  connectionCasesManaged: number;
  requirementsTracked: number;
  documentsTracked: number;
};

export type ReportExportRow = {
  slug: string;
  name: string;
  location: string;
  technology: Technology;
  importMW: number;
  exportMW: number;
  portfolioMW: number;
  gridOperator: string;
  stage: OverviewPipelineStage;
  outlook: Outlook;
  confidence: Confidence;
  targetCOD: string;
  readiness: string;
  connectionStatus: string;
  nextMilestone: string;
  deadline: string;
};

export type PortfolioReportViewModel = {
  organizationName: string;
  summary: {
    projectCount: number;
    portfolioMW: number;
    activeConnectionCases: number;
    needsAttention: number;
    openAlerts: number;
    averageReadinessPercent: number | null;
  };
  stageCounts: ReportNamedCount[];
  outlookCounts: ReportNamedCount[];
  operatorMW: ReportOperatorMW[];
  technologyMix: ReportTechnologyMix[];
  connectionHealth: ReportConnectionHealth;
  readiness: ReportReadinessBuckets;
  attentionProjects: ReportAttentionProject[];
  documentHealth: ReportDocumentHealth;
  operational: ReportOperationalMetrics;
  exportRows: ReportExportRow[];
};

export type PortfolioReportResult =
  | { kind: "ok"; report: PortfolioReportViewModel }
  | { kind: "no_organization" }
  | { kind: "error"; message: string };
