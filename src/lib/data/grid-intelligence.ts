import { cache } from "react";
import { getCurrentOrganization } from "@/lib/data/organization";
import {
  type ChangeImpact,
  type ChangeImpactLevel,
  type ChangeMatchType,
  type ChangeReviewStatus,
  type ExternalChange,
  type ExternalChangeSeverity,
  type ExternalChangeType,
  type GridArea,
  type GridAreaType,
  type GridAuthorityLevel,
  type GridConfidence,
  type GridObservation,
  type GridObservationDirection,
  type GridObservationType,
  type GridSource,
  type GridSourceType,
  type OfficialGridAreaContext,
  type OfficialGridAreaMatch,
  type OfficialNupContext,
  type OfficialNupFlexibilityNeed,
  type OfficialNupForecastNeed,
  type OfficialNupPlanningAreaMatch,
  type OfficialNupQualitativeObservation,
  type SourceSnapshot,
  type SourceSnapshotStatus,
  NUP_FORECAST_TRANSFER_CAPACITY_NEED,
  isOfficialEiNetworkAreaSource,
  isOfficialEiNupSource,
  officialGridAreaOperatorReview,
} from "@/lib/domain/grid-intelligence";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type {
  ChangeImpact,
  ExternalChange,
  GridArea,
  GridObservation,
  GridSource,
  OfficialGridAreaContext,
  OfficialNupContext,
  SourceSnapshot,
} from "@/lib/domain/grid-intelligence";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return {};
}

function asRecordOrNull(value: unknown): JsonRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  return null;
}

type SourceRow = {
  id: string;
  name: string;
  slug: string;
  source_type: string;
  operator_id: string | null;
  publisher: string | null;
  base_url: string | null;
  country_code: string;
  active: boolean;
  authority_level: string;
  update_frequency: string | null;
  created_at: string;
  updated_at: string;
};

type AreaRow = {
  id: string;
  source_id: string;
  operator_id: string | null;
  external_id: string | null;
  name: string;
  area_type: string;
  country_code: string;
  region: string | null;
  geometry: unknown;
  valid_from: string | null;
  valid_to: string | null;
  published_at: string | null;
  retrieved_at: string;
  confidence: string;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

type ObservationRow = {
  id: string;
  source_id: string;
  grid_area_id: string | null;
  operator_id: string | null;
  external_id: string | null;
  observation_type: string;
  value_numeric: number | string | null;
  value_text: string | null;
  unit: string | null;
  technology: string | null;
  direction: string | null;
  voltage_kv: number | string | null;
  effective_from: string | null;
  effective_to: string | null;
  published_at: string | null;
  retrieved_at: string;
  confidence: string;
  authority_level: string;
  source_url: string | null;
  raw_metadata: unknown;
  created_at: string;
};

type SnapshotRow = {
  id: string;
  source_id: string;
  retrieved_at: string;
  published_at: string | null;
  content_hash: string;
  raw_content: unknown;
  storage_path: string | null;
  status: string;
  metadata: unknown;
  created_at: string;
};

type ChangeRow = {
  id: string;
  source_id: string;
  previous_snapshot_id: string | null;
  current_snapshot_id: string;
  change_type: string;
  title: string;
  summary: string | null;
  severity: string;
  grid_area_id: string | null;
  detected_at: string;
  published_at: string | null;
  confidence: string;
  source_url: string | null;
  before_value: unknown;
  after_value: unknown;
  metadata: unknown;
  created_at: string;
};

type ImpactRow = {
  id: string;
  external_change_id: string;
  organization_id: string;
  project_id: string;
  match_type: string;
  impact_level: string;
  reason: string;
  confidence: string;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

function toNumberOrNull(value: number | string | null | undefined): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapSource(row: SourceRow): GridSource {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sourceType: row.source_type as GridSourceType,
    operatorId: row.operator_id,
    publisher: row.publisher,
    baseUrl: row.base_url,
    countryCode: row.country_code,
    active: row.active,
    authorityLevel: row.authority_level as GridAuthorityLevel,
    updateFrequency: row.update_frequency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapArea(row: AreaRow): GridArea {
  return {
    id: row.id,
    sourceId: row.source_id,
    operatorId: row.operator_id,
    externalId: row.external_id,
    name: row.name,
    areaType: row.area_type as GridAreaType,
    countryCode: row.country_code,
    region: row.region,
    hasGeometry: row.geometry != null,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    publishedAt: row.published_at,
    retrievedAt: row.retrieved_at,
    confidence: row.confidence as GridConfidence,
    metadata: asRecord(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapObservation(row: ObservationRow): GridObservation {
  return {
    id: row.id,
    sourceId: row.source_id,
    gridAreaId: row.grid_area_id,
    operatorId: row.operator_id,
    externalId: row.external_id,
    observationType: row.observation_type as GridObservationType,
    valueNumeric: toNumberOrNull(row.value_numeric),
    valueText: row.value_text,
    unit: row.unit,
    technology: row.technology,
    direction: (row.direction as GridObservationDirection | null) ?? null,
    voltageKv: toNumberOrNull(row.voltage_kv),
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    publishedAt: row.published_at,
    retrievedAt: row.retrieved_at,
    confidence: row.confidence as GridConfidence,
    authorityLevel: row.authority_level as GridAuthorityLevel,
    sourceUrl: row.source_url,
    rawMetadata: asRecord(row.raw_metadata),
    createdAt: row.created_at,
  };
}

function mapSnapshot(row: SnapshotRow): SourceSnapshot {
  return {
    id: row.id,
    sourceId: row.source_id,
    retrievedAt: row.retrieved_at,
    publishedAt: row.published_at,
    contentHash: row.content_hash,
    rawContent: asRecordOrNull(row.raw_content),
    storagePath: row.storage_path,
    status: row.status as SourceSnapshotStatus,
    metadata: asRecord(row.metadata),
    createdAt: row.created_at,
  };
}

function mapChange(row: ChangeRow): ExternalChange {
  return {
    id: row.id,
    sourceId: row.source_id,
    previousSnapshotId: row.previous_snapshot_id,
    currentSnapshotId: row.current_snapshot_id,
    changeType: row.change_type as ExternalChangeType,
    title: row.title,
    summary: row.summary,
    severity: row.severity as ExternalChangeSeverity,
    gridAreaId: row.grid_area_id,
    detectedAt: row.detected_at,
    publishedAt: row.published_at,
    confidence: row.confidence as GridConfidence,
    sourceUrl: row.source_url,
    beforeValue: asRecordOrNull(row.before_value),
    afterValue: asRecordOrNull(row.after_value),
    metadata: asRecord(row.metadata),
    createdAt: row.created_at,
  };
}

function mapImpact(row: ImpactRow): ChangeImpact {
  return {
    id: row.id,
    externalChangeId: row.external_change_id,
    organizationId: row.organization_id,
    projectId: row.project_id,
    matchType: row.match_type as ChangeMatchType,
    impactLevel: row.impact_level as ChangeImpactLevel,
    reason: row.reason,
    confidence: row.confidence as GridConfidence,
    reviewStatus: row.review_status as ChangeReviewStatus,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listGridSources(): Promise<GridSource[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("grid_sources")
    .select(
      "id, name, slug, source_type, operator_id, publisher, base_url, country_code, active, authority_level, update_frequency, created_at, updated_at",
    )
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("listGridSources failed", error.message);
    return [];
  }

  return ((data ?? []) as SourceRow[]).map(mapSource);
}

export async function listExternalChanges(): Promise<ExternalChange[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("external_changes")
    .select(
      "id, source_id, previous_snapshot_id, current_snapshot_id, change_type, title, summary, severity, grid_area_id, detected_at, published_at, confidence, source_url, before_value, after_value, metadata, created_at",
    )
    .order("detected_at", { ascending: false });

  if (error) {
    console.error("listExternalChanges failed", error.message);
    return [];
  }

  return ((data ?? []) as ChangeRow[]).map(mapChange);
}

export async function listChangeImpactsForCurrentOrganization(): Promise<ChangeImpact[]> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("change_impacts")
    .select(
      "id, external_change_id, organization_id, project_id, match_type, impact_level, reason, confidence, review_status, reviewed_by, reviewed_at, created_at, updated_at",
    )
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listChangeImpactsForCurrentOrganization failed", error.message);
    return [];
  }

  return ((data ?? []) as ImpactRow[]).map(mapImpact);
}

export function mapGridAreaRow(row: AreaRow): GridArea {
  return mapArea(row);
}

export function mapGridObservationRow(row: ObservationRow): GridObservation {
  return mapObservation(row);
}

export function mapSourceSnapshotRow(row: SnapshotRow): SourceSnapshot {
  return mapSnapshot(row);
}

type OfficialContextRpc = {
  project?: {
    id?: unknown;
    name?: unknown;
    slug?: unknown;
    gridOperatorName?: unknown;
  };
  coordinate?: {
    latitude?: unknown;
    longitude?: unknown;
  } | null;
  areas?: unknown;
  provenance?: {
    sourceId?: unknown;
    sourceName?: unknown;
    sourceSlug?: unknown;
    publisher?: unknown;
    sourceUrl?: unknown;
    publishedAt?: unknown;
    retrievedAt?: unknown;
    authorityLevel?: unknown;
    confidence?: unknown;
    dataType?: unknown;
    sourceType?: unknown;
  } | null;
};

function asStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function mapOfficialArea(value: unknown): OfficialGridAreaMatch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = asStringOrNull(row.id);
  const name = asStringOrNull(row.name);
  if (!id || !name) {
    return null;
  }
  return {
    id,
    name,
    areaType: (asStringOrNull(row.areaType) ?? "local_network") as GridAreaType,
    officialOperatorName: asStringOrNull(row.officialOperatorName),
    concessionId: asStringOrNull(row.concessionId),
    unitId: asStringOrNull(row.unitId),
    permittedVoltageKv: toNumberOrNull(
      typeof row.permittedVoltageKv === "number" || typeof row.permittedVoltageKv === "string"
        ? row.permittedVoltageKv
        : null,
    ),
  };
}

export const getOfficialGridAreaContextForProject = cache(
  async (projectId: string): Promise<OfficialGridAreaContext | null> => {
    const trimmed = projectId.trim();
    if (!trimmed) {
      return null;
    }

    const organization = await getCurrentOrganization();
    if (!organization) {
      return null;
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_official_grid_area_context_for_project", {
      p_project_id: trimmed,
    });

    if (error) {
      console.error("getOfficialGridAreaContextForProject failed", error.message);
      return null;
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }

    const payload = data as OfficialContextRpc;
    const projectIdValue = asStringOrNull(payload.project?.id);
    const projectName = asStringOrNull(payload.project?.name);
    const projectSlug = asStringOrNull(payload.project?.slug);
    if (!projectIdValue || !projectName || !projectSlug) {
      return null;
    }

    const latitude = toNumberOrNull(
      typeof payload.coordinate?.latitude === "number" ||
        typeof payload.coordinate?.latitude === "string"
        ? payload.coordinate.latitude
        : null,
    );
    const longitude = toNumberOrNull(
      typeof payload.coordinate?.longitude === "number" ||
        typeof payload.coordinate?.longitude === "string"
        ? payload.coordinate.longitude
        : null,
    );
    const coordinate =
      latitude != null && longitude != null ? { latitude, longitude } : null;
    const projectOperatorName = asStringOrNull(payload.project?.gridOperatorName);
    const provenanceRecord = payload.provenance;
    const sourceSlug = asStringOrNull(provenanceRecord?.sourceSlug);
    const authorityLevel = (asStringOrNull(provenanceRecord?.authorityLevel) ??
      "official") as GridAuthorityLevel;
    const officialEi = isOfficialEiNetworkAreaSource({ sourceSlug, authorityLevel });
    const areas = officialEi
      ? Array.isArray(payload.areas)
        ? payload.areas.map(mapOfficialArea).filter((area): area is OfficialGridAreaMatch => area != null)
        : []
      : [];
    const primaryOfficialOperator = areas[0]?.officialOperatorName ?? null;

    let sourceType: GridSourceType | null =
      (asStringOrNull(provenanceRecord?.sourceType) as GridSourceType | null) ?? null;
    if (officialEi && asStringOrNull(provenanceRecord?.sourceId) && !sourceType) {
      const { data: sourceRow } = await supabase
        .from("grid_sources")
        .select("source_type")
        .eq("id", asStringOrNull(provenanceRecord?.sourceId) ?? "")
        .maybeSingle();
      sourceType = asStringOrNull(sourceRow?.source_type) as GridSourceType | null;
    }

    const provenance =
      officialEi && provenanceRecord && asStringOrNull(provenanceRecord.sourceId)
        ? {
            sourceId: asStringOrNull(provenanceRecord.sourceId) ?? "",
            sourceName: asStringOrNull(provenanceRecord.sourceName) ?? "",
            sourceSlug: sourceSlug ?? "",
            publisher: asStringOrNull(provenanceRecord.publisher),
            sourceUrl: asStringOrNull(provenanceRecord.sourceUrl),
            publishedAt: asStringOrNull(provenanceRecord.publishedAt),
            retrievedAt: asStringOrNull(provenanceRecord.retrievedAt) ?? "",
            authorityLevel,
            confidence: (asStringOrNull(provenanceRecord.confidence) ?? "high") as GridConfidence,
            sourceType,
            dataType:
              asStringOrNull(provenanceRecord.dataType) ?? "Network area concession geography",
          }
        : null;

    return {
      project: {
        id: projectIdValue,
        name: projectName,
        slug: projectSlug,
        gridOperatorName: projectOperatorName,
      },
      coordinate,
      areas,
      provenance,
      operatorReview: officialGridAreaOperatorReview({
        projectOperatorName,
        officialOperatorName: primaryOfficialOperator,
        hasCoordinate: coordinate != null,
        hasOfficialArea: areas.length > 0,
      }),
    };
  },
);

type NupContextRpc = {
  project?: {
    id?: unknown;
    name?: unknown;
    slug?: unknown;
    gridOperatorName?: unknown;
  };
  coordinate?: {
    latitude?: unknown;
    longitude?: unknown;
  } | null;
  planningAreas?: unknown;
  provenance?: {
    sourceId?: unknown;
    sourceName?: unknown;
    sourceSlug?: unknown;
    publisher?: unknown;
    sourceUrl?: unknown;
    publishedAt?: unknown;
    retrievedAt?: unknown;
    authorityLevel?: unknown;
    confidence?: unknown;
    dataType?: unknown;
    sourceType?: unknown;
    planningPeriod?: unknown;
    datasetUpdate?: unknown;
  } | null;
};

function mapQualitativeObservation(value: unknown): OfficialNupQualitativeObservation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  return {
    valueText: asStringOrNull(row.valueText),
    semantic: asStringOrNull(row.semantic),
  };
}

function mapForecastNeed(value: unknown): OfficialNupForecastNeed | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const year = toNumberOrNull(
    typeof row.year === "number" || typeof row.year === "string" ? row.year : null,
  );
  if (year == null) {
    return null;
  }
  const representation = asStringOrNull(row.representation);
  return {
    year,
    valueNumeric: toNumberOrNull(
      typeof row.valueNumeric === "number" || typeof row.valueNumeric === "string"
        ? row.valueNumeric
        : null,
    ),
    valueText: asStringOrNull(row.valueText),
    unit: asStringOrNull(row.unit),
    representation:
      representation === "numeric_mw" || representation === "source_text" ? representation : null,
    semantic: NUP_FORECAST_TRANSFER_CAPACITY_NEED,
  };
}

function mapFlexibilityNeed(value: unknown): OfficialNupFlexibilityNeed | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  return {
    horizon: asStringOrNull(row.horizon),
    valueNumeric: toNumberOrNull(
      typeof row.valueNumeric === "number" || typeof row.valueNumeric === "string"
        ? row.valueNumeric
        : null,
    ),
    valueText: asStringOrNull(row.valueText),
    unit: asStringOrNull(row.unit),
    semantic: asStringOrNull(row.semantic),
  };
}

function mapNupPlanningArea(value: unknown): OfficialNupPlanningAreaMatch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const id = asStringOrNull(row.id);
  const name = asStringOrNull(row.name);
  if (!id || !name) {
    return null;
  }
  const observations =
    row.observations && typeof row.observations === "object" && !Array.isArray(row.observations)
      ? (row.observations as Record<string, unknown>)
      : {};
  return {
    id,
    name,
    areaType: (asStringOrNull(row.areaType) ?? "planning_area") as GridAreaType,
    officialOperatorName: asStringOrNull(row.officialOperatorName),
    organizationNumber: asStringOrNull(row.organizationNumber),
    accountingUnit: asStringOrNull(row.accountingUnit),
    delomrade: asStringOrNull(row.delomrade),
    externalId: asStringOrNull(row.externalId),
    planSourceUrl: asStringOrNull(row.planSourceUrl),
    observations: {
      forecastTransferCapacityNeed: Array.isArray(observations.forecastTransferCapacityNeed)
        ? observations.forecastTransferCapacityNeed
            .map(mapForecastNeed)
            .filter((item): item is OfficialNupForecastNeed => item != null)
        : [],
      plannedInvestments: mapQualitativeObservation(observations.plannedInvestments),
      flexibilityNeed: Array.isArray(observations.flexibilityNeed)
        ? observations.flexibilityNeed
            .map(mapFlexibilityNeed)
            .filter((item): item is OfficialNupFlexibilityNeed => item != null)
        : [],
      plannedMeasuresMeetOwnNetworkNeed: mapQualitativeObservation(
        observations.plannedMeasuresMeetOwnNetworkNeed,
      ),
      overlyingNetworkLimitation: mapQualitativeObservation(
        observations.overlyingNetworkLimitation,
      ),
    },
  };
}

export const getOfficialNetworkDevelopmentPlanContextForProject = cache(
  async (projectId: string): Promise<OfficialNupContext | null> => {
    const trimmed = projectId.trim();
    if (!trimmed) {
      return null;
    }

    const organization = await getCurrentOrganization();
    if (!organization) {
      return null;
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "get_official_network_development_plan_context_for_project",
      { p_project_id: trimmed },
    );

    if (error) {
      console.error("getOfficialNetworkDevelopmentPlanContextForProject failed", error.message);
      return null;
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }

    const payload = data as NupContextRpc;
    const projectIdValue = asStringOrNull(payload.project?.id);
    const projectName = asStringOrNull(payload.project?.name);
    const projectSlug = asStringOrNull(payload.project?.slug);
    if (!projectIdValue || !projectName || !projectSlug) {
      return null;
    }

    const latitude = toNumberOrNull(
      typeof payload.coordinate?.latitude === "number" ||
        typeof payload.coordinate?.latitude === "string"
        ? payload.coordinate.latitude
        : null,
    );
    const longitude = toNumberOrNull(
      typeof payload.coordinate?.longitude === "number" ||
        typeof payload.coordinate?.longitude === "string"
        ? payload.coordinate.longitude
        : null,
    );
    const coordinate =
      latitude != null && longitude != null ? { latitude, longitude } : null;
    const provenanceRecord = payload.provenance;
    const sourceSlug = asStringOrNull(provenanceRecord?.sourceSlug);
    const authorityLevel = (asStringOrNull(provenanceRecord?.authorityLevel) ??
      "official") as GridAuthorityLevel;
    const officialNup = isOfficialEiNupSource({ sourceSlug, authorityLevel });
    const planningAreas = officialNup
      ? Array.isArray(payload.planningAreas)
        ? payload.planningAreas
            .map(mapNupPlanningArea)
            .filter((area): area is OfficialNupPlanningAreaMatch => area != null)
        : []
      : [];

    const provenance =
      officialNup && provenanceRecord && asStringOrNull(provenanceRecord.sourceId)
        ? {
            sourceId: asStringOrNull(provenanceRecord.sourceId) ?? "",
            sourceName: asStringOrNull(provenanceRecord.sourceName) ?? "",
            sourceSlug: sourceSlug ?? "",
            publisher: asStringOrNull(provenanceRecord.publisher),
            sourceUrl: asStringOrNull(provenanceRecord.sourceUrl),
            publishedAt: asStringOrNull(provenanceRecord.publishedAt),
            retrievedAt: asStringOrNull(provenanceRecord.retrievedAt) ?? "",
            authorityLevel,
            confidence: (asStringOrNull(provenanceRecord.confidence) ?? "high") as GridConfidence,
            sourceType: (asStringOrNull(provenanceRecord.sourceType) as GridSourceType | null) ??
              "excel",
            dataType:
              asStringOrNull(provenanceRecord.dataType) ??
              "Network development plan (forecast need, not available capacity)",
            planningPeriod: asStringOrNull(provenanceRecord.planningPeriod),
            datasetUpdate: asStringOrNull(provenanceRecord.datasetUpdate),
          }
        : null;

    const matchStatus = !coordinate
      ? "no_coordinate"
      : planningAreas.length === 0
        ? "no_official_planning_area"
        : "matched";

    return {
      project: {
        id: projectIdValue,
        name: projectName,
        slug: projectSlug,
        gridOperatorName: asStringOrNull(payload.project?.gridOperatorName),
      },
      coordinate,
      planningAreas: await attachNupPlanSourceUrls(supabase, planningAreas),
      provenance,
      matchStatus,
    };
  },
);

async function attachNupPlanSourceUrls(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  areas: OfficialNupPlanningAreaMatch[],
): Promise<OfficialNupPlanningAreaMatch[]> {
  if (areas.length === 0) {
    return areas;
  }

  const { data, error } = await supabase
    .from("grid_observations")
    .select("grid_area_id, source_url")
    .in(
      "grid_area_id",
      areas.map((area) => area.id),
    );

  if (error) {
    console.error("NUP plan source URL lookup failed", error.message);
    return areas;
  }

  const urlByArea = new Map<string, string>();
  for (const row of data ?? []) {
    const areaId = asStringOrNull(row.grid_area_id);
    const sourceUrl = asStringOrNull(row.source_url);
    if (!areaId || !sourceUrl || sourceUrl === "N/A" || urlByArea.has(areaId)) {
      continue;
    }
    if (!/^https?:\/\//i.test(sourceUrl)) {
      continue;
    }
    urlByArea.set(areaId, sourceUrl);
  }

  return areas.map((area) => ({
    ...area,
    planSourceUrl: area.planSourceUrl ?? urlByArea.get(area.id) ?? null,
  }));
}
