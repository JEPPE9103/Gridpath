export type Technology =
  | "Battery Storage"
  | "Solar"
  | "Wind"
  | "EV Charging"
  | "Industrial"
  | "Other";

export type PipelineStage =
  | "Prospect"
  | "Screened"
  | "Enquiry"
  | "Application"
  | "Grid Study"
  | "Offer"
  | "Agreement"
  | "Construction";

export type ConnectionStage =
  | "Screening"
  | "Enquiry"
  | "Application"
  | "Grid Study"
  | "Offer"
  | "Agreement"
  | "Construction"
  | "Energisation";

export type Outlook =
  | "Favourable"
  | "Possible"
  | "At Risk"
  | "Weak"
  | "Needs Attention"
  | "Unknown";

export type Confidence = "High" | "Medium" | "Low" | "Unknown";

export type DataSourceKind =
  | "Official"
  | "Indicative"
  | "Customer Data"
  | "NOXHEIM Analysis";

export type AlertSeverity = "critical" | "warning" | "info" | "positive";

export type DocumentCategory =
  | "Technical"
  | "Land"
  | "Permit"
  | "Grid"
  | "Commercial";

export type RequirementCategory =
  | "Technical"
  | "Land"
  | "Permit"
  | "Grid"
  | "Commercial"
  | "Environmental"
  | "Other";

export type DocumentStatus = "Complete" | "In Progress" | "Missing" | "Draft";

export type ChecklistStatus =
  | "Complete"
  | "Incomplete"
  | "Missing"
  | "In Progress"
  | "Not Started";

export type ConnectionCaseStatus =
  | "On Track"
  | "At Risk"
  | "Overdue"
  | "Waiting";

export type ChangeType =
  | "Capacity"
  | "Reinforcement"
  | "Requirements"
  | "Deadlines"
  | "Operator updates";

export interface ProjectDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  status: DocumentStatus;
  updatedAt: string;
  owner: string;
  projectId: string;
}

export interface ConnectionHistoryEvent {
  id: string;
  date: string;
  title: string;
  detail: string;
  source?: DataSourceKind;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  summary: string;
  detail: string;
  operator?: string;
  projectId: string;
  timestamp: string;
  ctaLabel: string;
  href: string;
}

export interface GridIntelligence {
  operator: string;
  networkArea: string;
  voltageLevel: string;
  publicCapacitySignal: string;
  knownConstraints: string[];
  plannedReinforcement: string;
  source: DataSourceKind;
  sourceName: string;
  publicationDate: string;
  lastRetrieved: string;
  confidence: Confidence;
  previousIndication?: string;
  currentIndication?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  status: ChecklistStatus;
}

export interface ApplicationReadiness {
  percent: number;
  items: ChecklistItem[];
}

export interface StageDetail {
  stage: ConnectionStage;
  requirements: string[];
  submitted: string[];
  missing: string[];
  deadline?: string;
  owner: string;
  notes: string;
}

export interface ConnectionCase {
  id: string;
  caseId: string;
  projectId: string;
  operator: string;
  stage: ConnectionStage;
  submittedAt?: string;
  nextMilestone: string;
  deadline?: string;
  owner: string;
  status: ConnectionCaseStatus;
}

export interface GridChange {
  id: string;
  source: string;
  detectedAt: string;
  type: ChangeType;
  title: string;
  summary: string;
  affectedProjectIds: string[];
}

export interface ImpactMetrics {
  sitesDeprioritised: number;
  projectsMonitored: number;
  changesDetected: number;
  estimatedHoursAvoided: number;
}

export interface Project {
  id: string;
  name: string;
  location: string;
  region: string;
  latitude: number;
  longitude: number;
  technology: Technology;
  importMW: number;
  exportMW: number;
  gridOperator: string;
  voltageLevel: string;
  stage: PipelineStage;
  connectionStage: ConnectionStage;
  outlook: Outlook;
  confidence: Confidence;
  targetCOD: string;
  lastUpdated: string;
  description: string;
  knownConstraints: string[];
  reinforcementInfo: string;
  applicationReadiness: ApplicationReadiness;
  documents: ProjectDocument[];
  connectionHistory: ConnectionHistoryEvent[];
  alertIds: string[];
  grid: GridIntelligence;
  stageDetails: Record<ConnectionStage, StageDetail>;
  owner: string;
  caseId?: string;
}

export interface ProjectListItem {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  technology: Technology;
  importMW: number;
  exportMW: number;
  gridOperator: string;
  voltageLevel: string;
  stage: PipelineStage | "Energisation";
  outlook: Outlook;
  confidence: Confidence;
  targetCOD: string;
  lastUpdated: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  "Prospect",
  "Screened",
  "Enquiry",
  "Application",
  "Grid Study",
  "Offer",
  "Agreement",
  "Construction",
];

export const CONNECTION_STAGES: ConnectionStage[] = [
  "Screening",
  "Enquiry",
  "Application",
  "Grid Study",
  "Offer",
  "Agreement",
  "Construction",
  "Energisation",
];

export const TECHNOLOGIES: Technology[] = [
  "Battery Storage",
  "Solar",
  "Wind",
  "EV Charging",
  "Industrial",
  "Other",
];

export const OUTLOOKS: Outlook[] = [
  "Favourable",
  "Possible",
  "Needs Attention",
  "At Risk",
  "Weak",
  "Unknown",
];

export const CHANGE_TYPES: ChangeType[] = [
  "Capacity",
  "Reinforcement",
  "Requirements",
  "Deadlines",
  "Operator updates",
];

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  "Technical",
  "Land",
  "Permit",
  "Grid",
  "Commercial",
];
