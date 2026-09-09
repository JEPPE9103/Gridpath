export const OPPORTUNITY_TECHNOLOGY_VALUES = [
  "battery_storage",
  "solar",
  "wind",
  "hybrid",
  "data_center",
  "ev_infrastructure",
  "industrial",
  "hydrogen",
  "other",
] as const;

export type OpportunityTechnologyValue = (typeof OPPORTUNITY_TECHNOLOGY_VALUES)[number];

export const OPPORTUNITY_STATUS_VALUES = [
  "identified",
  "screening",
  "strong_candidate",
  "under_review",
  "shortlisted",
  "promoted",
  "rejected",
] as const;

export type OpportunityStatusValue = (typeof OPPORTUNITY_STATUS_VALUES)[number];

export const OPPORTUNITY_RECOMMENDATION_VALUES = [
  "prioritise",
  "investigate",
  "secondary",
  "low_priority",
  "insufficient_evidence",
] as const;

export type OpportunityRecommendationValue = (typeof OPPORTUNITY_RECOMMENDATION_VALUES)[number];

export const OPPORTUNITY_CONFIDENCE_VALUES = ["high", "medium", "low", "unknown"] as const;

export type OpportunityConfidenceValue = (typeof OPPORTUNITY_CONFIDENCE_VALUES)[number];

export const OPPORTUNITY_REJECT_REASON_VALUES = [
  "grid",
  "environmental",
  "land",
  "planning",
  "economics",
  "access",
  "strategic_fit",
  "duplicate",
  "other",
] as const;

export type OpportunityRejectReasonValue = (typeof OPPORTUNITY_REJECT_REASON_VALUES)[number];

export const ASSESSMENT_DIMENSION_VALUES = [
  "grid_context",
  "grid_proximity",
  "land_suitability",
  "environmental",
  "planning",
  "access",
  "strategic_fit",
] as const;

export type AssessmentDimensionKey = (typeof ASSESSMENT_DIMENSION_VALUES)[number];

export const DIMENSION_RESULT_VALUES = [
  "strong",
  "moderate",
  "low_conflict",
  "review_required",
  "unavailable",
  "excluded",
] as const;

export type DimensionResultValue = (typeof DIMENSION_RESULT_VALUES)[number];

export const EVIDENCE_SOURCE_VALUES = ["customer_data", "official", "noxheim_derived"] as const;

export type EvidenceSourceValue = (typeof EVIDENCE_SOURCE_VALUES)[number];

const TECHNOLOGY_LABELS: Record<OpportunityTechnologyValue, string> = {
  battery_storage: "BESS",
  solar: "Solar",
  wind: "Wind",
  hybrid: "Hybrid",
  data_center: "Data centre",
  ev_infrastructure: "EV charging",
  industrial: "Industrial load",
  hydrogen: "Hydrogen",
  other: "Other",
};

const STATUS_LABELS: Record<OpportunityStatusValue, string> = {
  identified: "Identified",
  screening: "Screening",
  strong_candidate: "Strong candidate",
  under_review: "Under review",
  shortlisted: "Shortlisted",
  promoted: "Promoted",
  rejected: "Rejected",
};

const RECOMMENDATION_LABELS: Record<OpportunityRecommendationValue, string> = {
  prioritise: "Priority for further investigation",
  investigate: "Worth investigating",
  secondary: "Secondary screening priority",
  low_priority: "Do not prioritise based on current evidence",
  insufficient_evidence: "Insufficient evidence to rank confidently",
};

const CONFIDENCE_LABELS: Record<OpportunityConfidenceValue, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  unknown: "Unknown",
};

const REJECT_REASON_LABELS: Record<OpportunityRejectReasonValue, string> = {
  grid: "Grid",
  environmental: "Environmental",
  land: "Land",
  planning: "Planning",
  economics: "Economics",
  access: "Access",
  strategic_fit: "Strategic fit",
  duplicate: "Duplicate",
  other: "Other",
};

const DIMENSION_LABELS: Record<AssessmentDimensionKey, string> = {
  grid_context: "Grid context",
  grid_proximity: "Grid proximity",
  land_suitability: "Land suitability",
  environmental: "Environmental constraints",
  planning: "Planning context",
  access: "Access",
  strategic_fit: "Strategic fit",
};

const DIMENSION_RESULT_LABELS: Record<DimensionResultValue, string> = {
  strong: "Strong",
  moderate: "Moderate",
  low_conflict: "Low conflict",
  review_required: "Review required",
  unavailable: "Insufficient evidence",
  excluded: "Excluded",
};

const SOURCE_LABELS: Record<EvidenceSourceValue, string> = {
  customer_data: "Customer Data",
  official: "Official Source",
  noxheim_derived: "Noxheim Derived",
};

function labelFrom<T extends string>(value: string | null | undefined, map: Record<T, string>, fallback: string): string {
  if (!value) return fallback;
  return map[value as T] ?? fallback;
}

export function opportunityTechnologyLabel(value: string | null | undefined): string {
  return labelFrom(value, TECHNOLOGY_LABELS, "Other");
}

export function opportunityStatusLabel(value: string | null | undefined): string {
  return labelFrom(value, STATUS_LABELS, "Identified");
}

export function opportunityRecommendationLabel(value: string | null | undefined): string {
  return labelFrom(value, RECOMMENDATION_LABELS, "Insufficient evidence to rank confidently");
}

export function opportunityConfidenceLabel(value: string | null | undefined): string {
  return labelFrom(value, CONFIDENCE_LABELS, "Unknown");
}

export function opportunityRejectReasonLabel(value: string | null | undefined): string {
  return labelFrom(value, REJECT_REASON_LABELS, "Other");
}

export function assessmentDimensionLabel(value: string | null | undefined): string {
  return labelFrom(value, DIMENSION_LABELS, "Assessment");
}

export function dimensionResultLabel(value: string | null | undefined): string {
  return labelFrom(value, DIMENSION_RESULT_LABELS, "Insufficient evidence");
}

export function evidenceSourceLabel(value: string | null | undefined): string {
  return labelFrom(value, SOURCE_LABELS, "Noxheim Derived");
}

export function isOpportunityTechnology(value: string): value is OpportunityTechnologyValue {
  return (OPPORTUNITY_TECHNOLOGY_VALUES as readonly string[]).includes(value);
}

export function isOpportunityStatus(value: string): value is OpportunityStatusValue {
  return (OPPORTUNITY_STATUS_VALUES as readonly string[]).includes(value);
}

export function isOpportunityRecommendation(value: string): value is OpportunityRecommendationValue {
  return (OPPORTUNITY_RECOMMENDATION_VALUES as readonly string[]).includes(value);
}

export function isOpportunityConfidence(value: string): value is OpportunityConfidenceValue {
  return (OPPORTUNITY_CONFIDENCE_VALUES as readonly string[]).includes(value);
}

export function technologyToProjectDb(
  value: OpportunityTechnologyValue,
): "battery_storage" | "solar" | "wind" | "ev_infrastructure" | "industrial" | "other" {
  switch (value) {
    case "battery_storage":
      return "battery_storage";
    case "solar":
      return "solar";
    case "wind":
      return "wind";
    case "ev_infrastructure":
      return "ev_infrastructure";
    case "industrial":
    case "data_center":
      return "industrial";
    default:
      return "other";
  }
}

export function initialStatusForRecommendation(
  recommendation: OpportunityRecommendationValue,
): OpportunityStatusValue {
  switch (recommendation) {
    case "prioritise":
      return "strong_candidate";
    case "investigate":
      return "screening";
    case "secondary":
      return "identified";
    case "low_priority":
      return "identified";
    default:
      return "screening";
  }
}
