import type { OverviewPipelineStage } from "@/lib/data/overview-types";
import type { DocumentFileKind } from "@/lib/documents/file-types";
import type {
  OfficialGridAreaContext,
  OfficialNupContext,
} from "@/lib/domain/grid-intelligence";
import type { OfficialChangeImpactCounts } from "@/lib/data/grid-changes-types";
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
  storagePath: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  fileKind: DocumentFileKind;
  fileSizeBytes: number | null;
  uploadedAt: string | null;
  uploadedByName: string | null;
  hasStoredFile: boolean;
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
  id: string;
  caseId: string | null;
  stage: OverviewPipelineStage;
  stageValue: string;
  status: ConnectionCaseStatus | "Complete" | "Cancelled";
  statusValue: string;
  submittedAt: string | null;
  nextMilestone: string | null;
  deadline: string | null;
  ownerName: string | null;
  notes: string | null;
  createdAt: string | null;
  gridOperatorId: string | null;
  gridOperatorName: string | null;
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
  gridOperatorId: string | null;
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
  canEdit: boolean;
  canArchive: boolean;
  canDelete: boolean;
  archivedAt: string | null;
  canDeleteRequirements: boolean;
  canManageConnectionCase: boolean;
  canDeleteConnectionCase: boolean;
  officialGridAreaContext: OfficialGridAreaContext | null;
  officialNetworkDevelopmentPlanContext: OfficialNupContext | null;
  officialChanges: OfficialChangeImpactCounts;
  originatingOpportunity: { slug: string; name: string } | null;
};

export type ProjectDetailResult =
  | { kind: "ok"; project: ProjectDetailViewModel }
  | { kind: "not_found" }
  | { kind: "error"; message: string };
