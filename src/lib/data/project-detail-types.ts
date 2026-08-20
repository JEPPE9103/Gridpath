import type { OverviewPipelineStage } from "@/lib/data/overview-types";
import type {
  OfficialGridAreaContext,
  OfficialNupContext,
} from "@/lib/domain/grid-intelligence";
import type {
  AlertSeverity,
  ChecklistStatus,
  Confidence,
  ConnectionCaseStatus,
  DataSourceKind,
  DocumentCategory,
  DocumentStatus,
  Outlook,
  RequirementCategory,
  Technology,
} from "@/types";

export type ProjectRequirementItem = {
  id: string;
  label: string;
  status: ChecklistStatus;
  required: boolean;
  category: RequirementCategory;
  dueDate: string | null;
};

export type ProjectDocumentItem = {
  id: string;
  name: string;
  category: DocumentCategory | "Other";
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  owner: string | null;
};

export type ProjectEventItem = {
  id: string;
  title: string;
  detail: string;
  occurredAt: string;
  eventType: string | null;
  source: DataSourceKind | null;
};

export type ProjectAlertItem = {
  id: string;
  severity: AlertSeverity;
  title: string;
  summary: string;
};

export type ProjectConnectionCase = {
  caseId: string | null;
  status: ConnectionCaseStatus | "Complete" | "Cancelled";
  submittedAt: string | null;
  nextMilestone: string | null;
  deadline: string | null;
  ownerName: string | null;
  notes: string | null;
};

export type ProjectDetailViewModel = {
  id: string;
  slug: string;
  name: string;
  description: string;
  technology: Technology;
  location: string;
  region: string;
  latitude: number;
  longitude: number;
  hasCoordinates: boolean;
  importMW: number;
  exportMW: number;
  gridOperator: string;
  voltageLevel: string;
  stage: OverviewPipelineStage;
  outlook: Outlook;
  confidence: Confidence;
  targetCOD: string;
  lastUpdated: string;
  readinessPercent: number | null;
  readinessCompleteCount: number;
  readinessRequiredCount: number;
  requirements: ProjectRequirementItem[];
  connectionCase: ProjectConnectionCase | null;
  documents: ProjectDocumentItem[];
  events: ProjectEventItem[];
  alerts: ProjectAlertItem[];
  canUpdateRequirements: boolean;
  officialGridAreaContext: OfficialGridAreaContext | null;
  officialNetworkDevelopmentPlanContext: OfficialNupContext | null;
};

export type ProjectDetailResult =
  | { kind: "ok"; project: ProjectDetailViewModel }
  | { kind: "not_found" }
  | { kind: "error"; message: string };
