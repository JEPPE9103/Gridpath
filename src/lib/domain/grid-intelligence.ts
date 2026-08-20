import type { DataSourceKind } from "@/types";

export const OFFICIAL_EI_NETWORK_AREA_SOURCE_SLUG = "ei-network-area-concessions";
export const OFFICIAL_EI_NUP_SOURCE_SLUG = "ei-network-development-plans";

export const NUP_FORECAST_TRANSFER_CAPACITY_NEED = "forecast_transfer_capacity_need";

export function isOfficialEiNetworkAreaSource(input: {
  sourceSlug?: string | null;
  authorityLevel?: GridAuthorityLevel | null;
}): boolean {
  return (
    input.sourceSlug === OFFICIAL_EI_NETWORK_AREA_SOURCE_SLUG &&
    (input.authorityLevel === "official" || input.authorityLevel === "regulator")
  );
}

export function isOfficialEiNupSource(input: {
  sourceSlug?: string | null;
  authorityLevel?: GridAuthorityLevel | null;
}): boolean {
  return (
    input.sourceSlug === OFFICIAL_EI_NUP_SOURCE_SLUG &&
    (input.authorityLevel === "official" || input.authorityLevel === "regulator")
  );
}

export type GridSourceType =
  | "api"
  | "gis"
  | "csv"
  | "excel"
  | "pdf"
  | "html"
  | "manual"
  | "licensed";

export type GridAuthorityLevel =
  | "official"
  | "operator"
  | "regulator"
  | "third_party"
  | "customer"
  | "noxheim";

export type GridConfidence = "high" | "medium" | "low" | "unknown";

export type GridAreaType =
  | "local_network"
  | "regional_network"
  | "transmission_area"
  | "capacity_area"
  | "planning_area"
  | "other";

export type GridObservationType =
  | "capacity_signal"
  | "connection_outlook"
  | "reinforcement"
  | "constraint"
  | "timeline"
  | "requirement"
  | "tariff"
  | "process"
  | "other";

export type GridObservationDirection = "import" | "export" | "both" | "not_applicable";

export type SourceSnapshotStatus = "success" | "unchanged" | "failed" | "partial";

export type ExternalChangeType =
  | "capacity"
  | "reinforcement"
  | "constraint"
  | "timeline"
  | "requirement"
  | "process"
  | "tariff"
  | "geography"
  | "other";

export type ExternalChangeSeverity = "info" | "positive" | "warning" | "critical";

export type ChangeMatchType = "geographic" | "operator" | "explicit" | "rule_based";

export type ChangeImpactLevel = "informational" | "review" | "potentially_material";

export type ChangeReviewStatus = "unreviewed" | "confirmed" | "dismissed";

export type GridProvenance = {
  sourceId: string;
  sourceName: string;
  sourceSlug: string;
  publisher: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  authorityLevel: GridAuthorityLevel;
  confidence: GridConfidence;
  sourceType: GridSourceType | null;
  dataType: string | null;
};

export type GridSource = {
  id: string;
  name: string;
  slug: string;
  sourceType: GridSourceType;
  operatorId: string | null;
  publisher: string | null;
  baseUrl: string | null;
  countryCode: string;
  active: boolean;
  authorityLevel: GridAuthorityLevel;
  updateFrequency: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GridArea = {
  id: string;
  sourceId: string;
  operatorId: string | null;
  externalId: string | null;
  name: string;
  areaType: GridAreaType;
  countryCode: string;
  region: string | null;
  hasGeometry: boolean;
  validFrom: string | null;
  validTo: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  confidence: GridConfidence;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GridObservation = {
  id: string;
  sourceId: string;
  gridAreaId: string | null;
  operatorId: string | null;
  externalId: string | null;
  observationType: GridObservationType;
  valueNumeric: number | null;
  valueText: string | null;
  unit: string | null;
  technology: string | null;
  direction: GridObservationDirection | null;
  voltageKv: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  confidence: GridConfidence;
  authorityLevel: GridAuthorityLevel;
  sourceUrl: string | null;
  rawMetadata: Record<string, unknown>;
  createdAt: string;
};

export type SourceSnapshot = {
  id: string;
  sourceId: string;
  retrievedAt: string;
  publishedAt: string | null;
  contentHash: string;
  rawContent: Record<string, unknown> | null;
  storagePath: string | null;
  status: SourceSnapshotStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ExternalChange = {
  id: string;
  sourceId: string;
  previousSnapshotId: string | null;
  currentSnapshotId: string;
  changeType: ExternalChangeType;
  title: string;
  summary: string | null;
  severity: ExternalChangeSeverity;
  gridAreaId: string | null;
  detectedAt: string;
  publishedAt: string | null;
  confidence: GridConfidence;
  sourceUrl: string | null;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ChangeImpact = {
  id: string;
  externalChangeId: string;
  organizationId: string;
  projectId: string;
  matchType: ChangeMatchType;
  impactLevel: ChangeImpactLevel;
  reason: string;
  confidence: GridConfidence;
  reviewStatus: ChangeReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const AUTHORITY_TO_DATA_SOURCE: Record<GridAuthorityLevel, DataSourceKind> = {
  official: "Official",
  regulator: "Official",
  operator: "Indicative",
  third_party: "Indicative",
  customer: "Customer Data",
  noxheim: "NOXHEIM Analysis",
};

export function authorityToDataSourceKind(level: GridAuthorityLevel): DataSourceKind {
  return AUTHORITY_TO_DATA_SOURCE[level];
}

export type OfficialGridAreaOperatorReviewStatus =
  | "aligned"
  | "differs"
  | "no_official_area"
  | "no_project_operator"
  | "no_coordinate";

export type OfficialGridAreaMatch = {
  id: string;
  name: string;
  areaType: GridAreaType;
  officialOperatorName: string | null;
  concessionId: string | null;
  unitId: string | null;
  permittedVoltageKv: number | null;
};

export type OfficialGridAreaContext = {
  project: {
    id: string;
    name: string;
    slug: string;
    gridOperatorName: string | null;
  };
  coordinate: {
    latitude: number;
    longitude: number;
  } | null;
  areas: OfficialGridAreaMatch[];
  provenance: GridProvenance | null;
  operatorReview: {
    status: OfficialGridAreaOperatorReviewStatus;
    message: string;
  };
};

export type NupForecastRepresentation = "numeric_mw" | "source_text";

export type OfficialNupForecastNeed = {
  year: number;
  valueNumeric: number | null;
  valueText: string | null;
  unit: string | null;
  representation: NupForecastRepresentation | null;
  semantic: typeof NUP_FORECAST_TRANSFER_CAPACITY_NEED;
};

export type OfficialNupQualitativeObservation = {
  valueText: string | null;
  semantic: string | null;
};

export type OfficialNupFlexibilityNeed = {
  horizon: string | null;
  valueNumeric: number | null;
  valueText: string | null;
  unit: string | null;
  semantic: string | null;
};

export type OfficialNupPlanningAreaMatch = {
  id: string;
  name: string;
  areaType: GridAreaType;
  officialOperatorName: string | null;
  organizationNumber: string | null;
  accountingUnit: string | null;
  delomrade: string | null;
  externalId: string | null;
  planSourceUrl: string | null;
  observations: {
    forecastTransferCapacityNeed: OfficialNupForecastNeed[];
    plannedInvestments: OfficialNupQualitativeObservation | null;
    flexibilityNeed: OfficialNupFlexibilityNeed[];
    plannedMeasuresMeetOwnNetworkNeed: OfficialNupQualitativeObservation | null;
    overlyingNetworkLimitation: OfficialNupQualitativeObservation | null;
  };
};

export type OfficialNupContext = {
  project: {
    id: string;
    name: string;
    slug: string;
    gridOperatorName: string | null;
  };
  coordinate: {
    latitude: number;
    longitude: number;
  } | null;
  planningAreas: OfficialNupPlanningAreaMatch[];
  provenance: (GridProvenance & {
    planningPeriod: string | null;
    datasetUpdate: string | null;
  }) | null;
  matchStatus: "matched" | "no_official_planning_area" | "no_coordinate";
};

export function isNumericMwForecastSeries(values: OfficialNupForecastNeed[]): boolean {
  if (values.length === 0) {
    return false;
  }
  return values.every(
    (item) =>
      item.representation === "numeric_mw" &&
      item.valueNumeric != null &&
      Number.isFinite(item.valueNumeric) &&
      item.unit === "MW",
  );
}

export function officialGridAreaOperatorReview(input: {
  projectOperatorName: string | null;
  officialOperatorName: string | null;
  hasCoordinate: boolean;
  hasOfficialArea: boolean;
}): OfficialGridAreaContext["operatorReview"] {
  if (!input.hasCoordinate) {
    return {
      status: "no_coordinate",
      message: "Project has no primary site coordinate, so official Ei area matching could not run.",
    };
  }

  if (!input.hasOfficialArea) {
    return {
      status: "no_official_area",
      message: "No official Ei local-network concession area covers this site.",
    };
  }

  if (!input.projectOperatorName) {
    return {
      status: "no_project_operator",
      message: "Official Ei local-network area found; project has no grid operator assignment.",
    };
  }

  if (!input.officialOperatorName) {
    return {
      status: "differs",
      message:
        "Operator assignment differs from official local-area context — review required.",
    };
  }

  if (input.projectOperatorName === input.officialOperatorName) {
    return {
      status: "aligned",
      message: "Customer project operator matches the official Ei local-area company name.",
    };
  }

  return {
    status: "differs",
    message:
      "Operator assignment differs from official local-area context — review required. A development project can involve different voltage or network levels, so this is not automatically a customer-data error.",
  };
}

export function gridProvenance(input: {
  source: Pick<GridSource, "id" | "name" | "slug" | "publisher" | "authorityLevel">;
  sourceUrl?: string | null;
  publishedAt?: string | null;
  retrievedAt: string;
  confidence: GridConfidence;
  sourceType?: GridSourceType | null;
  dataType?: string | null;
}): GridProvenance {
  return {
    sourceId: input.source.id,
    sourceName: input.source.name,
    sourceSlug: input.source.slug,
    publisher: input.source.publisher,
    sourceUrl: input.sourceUrl ?? null,
    publishedAt: input.publishedAt ?? null,
    retrievedAt: input.retrievedAt,
    authorityLevel: input.source.authorityLevel,
    confidence: input.confidence,
    sourceType: input.sourceType ?? null,
    dataType: input.dataType ?? null,
  };
}
