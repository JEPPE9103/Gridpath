import type {
  ChecklistStatus,
  Confidence,
  ConnectionCaseStatus,
  DataSourceKind,
  DocumentCategory,
  DocumentStatus,
  Outlook,
  PipelineStage,
  RequirementCategory,
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

const REQUIREMENT_CATEGORY_LABELS: Record<string, RequirementCategory> = {
  technical: "Technical",
  land: "Land",
  permit: "Permit",
  grid: "Grid",
  commercial: "Commercial",
  environmental: "Environmental",
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

const GRID_AREA_TYPE_LABELS: Record<string, string> = {
  local_network: "Local network",
  regional_network: "Regional network",
  transmission_area: "Transmission area",
  capacity_area: "Capacity area",
  planning_area: "Planning area",
  other: "Other",
};

const GRID_SOURCE_TYPE_LABELS: Record<string, string> = {
  api: "API",
  gis: "GIS",
  csv: "CSV",
  excel: "Excel",
  pdf: "PDF",
  html: "HTML",
  manual: "Manual",
  licensed: "Licensed",
};

const GRID_AUTHORITY_LABELS: Record<string, string> = {
  official: "Official",
  regulator: "Official",
  operator: "Operator",
  third_party: "Third party",
  customer: "Customer",
  noxheim: "NOXHEIM",
};

export function gridAreaTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return GRID_AREA_TYPE_LABELS[value] ?? value.replaceAll("_", " ");
}

export function gridSourceTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return GRID_SOURCE_TYPE_LABELS[value] ?? value;
}

export function gridAuthorityLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return GRID_AUTHORITY_LABELS[value] ?? value;
}

export function checklistStatusLabel(value: string | null | undefined): ChecklistStatus {
  return labelFromMap(value, CHECKLIST_STATUS_LABELS, "Not Started");
}

export function documentStatusLabel(value: string | null | undefined): DocumentStatus {
  return labelFromMap(value, DOCUMENT_STATUS_LABELS, "Missing");
}

export function documentCategoryLabel(value: string | null | undefined): DocumentCategory | "Other" {
  return labelFromMap(value, DOCUMENT_CATEGORY_LABELS, "Other");
}

const DOCUMENT_STATUS_DB: Record<DocumentStatus, string> = {
  Complete: "complete",
  "In Progress": "in_progress",
  Missing: "missing",
  Draft: "draft",
};

const DOCUMENT_CATEGORY_DB: Record<DocumentCategory | "Other", string> = {
  Technical: "technical",
  Land: "land",
  Permit: "permit",
  Grid: "grid",
  Commercial: "commercial",
  Other: "other",
};

export function documentStatusToDb(status: DocumentStatus): string {
  return DOCUMENT_STATUS_DB[status];
}

export function documentCategoryToDb(category: DocumentCategory | "Other"): string {
  return DOCUMENT_CATEGORY_DB[category];
}

export function isDocumentStatus(value: string): value is DocumentStatus {
  return value in DOCUMENT_STATUS_DB;
}

export function isDocumentCategory(value: string): value is DocumentCategory | "Other" {
  return value in DOCUMENT_CATEGORY_DB;
}

export function requirementCategoryLabel(
  value: string | null | undefined,
): RequirementCategory {
  return labelFromMap(value, REQUIREMENT_CATEGORY_LABELS, "Other");
}

const CHECKLIST_STATUS_DB: Record<ChecklistStatus, string> = {
  Complete: "complete",
  Incomplete: "incomplete",
  Missing: "missing",
  "In Progress": "in_progress",
  "Not Started": "not_started",
};

export function checklistStatusToDb(status: ChecklistStatus): string {
  return CHECKLIST_STATUS_DB[status];
}

export function isChecklistStatus(value: string): value is ChecklistStatus {
  return value in CHECKLIST_STATUS_DB;
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

export const NUP_DATASET_LABEL = "Elnätsföretagens nätutvecklingsplaner";

const NUP_SIMPLE_ANSWERS: Record<string, string> = {
  Ja: "Yes",
  Nej: "No",
  Delvis: "Partly",
  "N/A": "N/A",
};

const NUP_HORIZON_LABELS: Record<string, string> = {
  "0-2": "0–2 years",
  "3-5": "3–5 years",
  "6-10": "6–10 years",
};

export function nupPlanningScopeLabel(delomrade: string | null | undefined): string {
  const value = delomrade?.trim() ?? "";
  if (!value || value === "whole-unit") {
    return "Whole reporting unit";
  }
  return value;
}

export function nupHorizonLabel(horizon: string | null | undefined): string {
  if (!horizon) {
    return "—";
  }
  return NUP_HORIZON_LABELS[horizon] ?? horizon;
}

export function nupPublishedAnswerLabel(value: string | null | undefined): {
  display: string;
  missing: boolean;
  mapped: boolean;
} {
  const trimmed = (value ?? "").replace(/\r\n/g, "\n").trim();
  if (!trimmed) {
    return { display: "Not published", missing: true, mapped: false };
  }
  const mapped = NUP_SIMPLE_ANSWERS[trimmed];
  if (mapped) {
    return { display: mapped, missing: false, mapped: true };
  }
  return { display: trimmed, missing: false, mapped: false };
}
