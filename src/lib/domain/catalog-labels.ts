import type {
  ChecklistStatus,
  Confidence,
  ConnectionCaseStatus,
  DataSourceKind,
  DocumentCategory,
  DocumentStatus,
  Outlook,
  PipelineStage,
  Technology,
} from "@/types";

const TECHNOLOGY_LABELS: Record<string, Technology> = {
  battery_storage: "Battery Storage",
  solar: "Solar",
  wind: "Wind",
  ev_infrastructure: "EV Charging",
  industrial: "Industrial",
};

const STAGE_LABELS: Record<string, PipelineStage | "Energisation"> = {
  prospect: "Prospect",
  screened: "Screened",
  enquiry: "Enquiry",
  application: "Application",
  grid_study: "Grid Study",
  offer: "Offer",
  agreement: "Agreement",
  construction: "Construction",
  energisation: "Energisation",
};

const OUTLOOK_LABELS: Record<string, Outlook> = {
  favourable: "Favourable",
  possible: "Possible",
  at_risk: "At Risk",
  weak: "Weak",
  unknown: "Unknown",
};

const CONFIDENCE_LABELS: Record<string, Confidence> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  unknown: "Unknown",
};

const CHECKLIST_STATUS_LABELS: Record<string, ChecklistStatus> = {
  complete: "Complete",
  incomplete: "Incomplete",
  missing: "Missing",
  in_progress: "In Progress",
  not_started: "Not Started",
};

const DOCUMENT_STATUS_LABELS: Record<string, DocumentStatus> = {
  complete: "Complete",
  in_progress: "In Progress",
  missing: "Missing",
  draft: "Draft",
};

const DOCUMENT_CATEGORY_LABELS: Record<string, DocumentCategory | "Other"> = {
  technical: "Technical",
  land: "Land",
  permit: "Permit",
  grid: "Grid",
  commercial: "Commercial",
  other: "Other",
};

const CASE_STATUS_LABELS: Record<string, ConnectionCaseStatus | "Complete" | "Cancelled"> = {
  on_track: "On Track",
  waiting: "Waiting",
  at_risk: "At Risk",
  overdue: "Overdue",
  complete: "Complete",
  cancelled: "Cancelled",
};

const DATA_SOURCE_LABELS: Record<string, DataSourceKind> = {
  official: "Official",
  indicative: "Indicative",
  customer_data: "Customer Data",
  noxheim_analysis: "NOXHEIM Analysis",
  Official: "Official",
  Indicative: "Indicative",
  "Customer Data": "Customer Data",
  "NOXHEIM Analysis": "NOXHEIM Analysis",
};

function labelFromMap<T extends string>(
  value: string | null | undefined,
  labels: Record<string, T>,
  fallback: T,
): T {
  if (!value) {
    return fallback;
  }
  return labels[value] ?? fallback;
}

export function technologyLabel(value: string | null | undefined): Technology {
  return labelFromMap(value, TECHNOLOGY_LABELS, "Industrial");
}

export function pipelineStageLabel(
  value: string | null | undefined,
): PipelineStage | "Energisation" {
  return labelFromMap(value, STAGE_LABELS, "Prospect");
}

export function outlookLabel(value: string | null | undefined): Outlook {
  return labelFromMap(value, OUTLOOK_LABELS, "Unknown");
}

export function confidenceLabel(value: string | null | undefined): Confidence {
  return labelFromMap(value, CONFIDENCE_LABELS, "Unknown");
}

export function checklistStatusLabel(value: string | null | undefined): ChecklistStatus {
  return labelFromMap(value, CHECKLIST_STATUS_LABELS, "Not Started");
}

export function documentStatusLabel(value: string | null | undefined): DocumentStatus {
  return labelFromMap(value, DOCUMENT_STATUS_LABELS, "Missing");
}

export function documentCategoryLabel(value: string | null | undefined): DocumentCategory | "Other" {
  return labelFromMap(value, DOCUMENT_CATEGORY_LABELS, "Grid");
}

export function connectionCaseStatusLabel(
  value: string | null | undefined,
): ConnectionCaseStatus | "Complete" | "Cancelled" {
  return labelFromMap(value, CASE_STATUS_LABELS, "On Track");
}

export function dataSourceLabel(value: string | null | undefined): DataSourceKind | null {
  if (!value) {
    return null;
  }
  return DATA_SOURCE_LABELS[value] ?? null;
}
