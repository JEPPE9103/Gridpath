export const OFFICIAL_MAP_LAYERS = ["local_network", "planning_area"] as const;
export type OfficialMapLayer = (typeof OFFICIAL_MAP_LAYERS)[number];

export const SWEDEN_MAP_BOUNDS = {
  west: 10.3,
  south: 55.0,
  east: 24.6,
  north: 69.4,
} as const;

export const NUP_FORECAST_NEED_MAP_DISCLAIMER =
  "Published forecast transfer-capacity need. This does not represent available connection capacity or grid headroom.";

export const LOCAL_NETWORK_UNMATCHED_TITLE = "No local network area match";
export const LOCAL_NETWORK_UNMATCHED_BODY =
  "NOXHEIM did not find an official Ei local-network geometry covering this project coordinate in the current dataset.";

export const NUP_UNMATCHED_TITLE = "No NUP context match";
export const NUP_UNMATCHED_BODY =
  "No published NUP geography currently matched this project location.";

export const COVERING_OFFICIAL_AREA_LABEL = "Covering official area";

const FORBIDDEN_CAPACITY_TERMS = [
  "available grid capacity",
  "available mw",
  "connectable mw",
  "probability of connection",
  "guaranteed feasibility",
  "real-time grid capacity",
  "no grid exists here",
  "no capacity",
  "your connection area",
] as const;

export type OfficialMapProvenance = {
  sourceId: string;
  sourceName: string;
  sourceSlug: string;
  publisher: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
  retrievedAt: string | null;
  authorityLevel: string | null;
  dataType: string | null;
  planningPeriod?: string | null;
};

export type OfficialMapFeatureProperties = {
  id: string;
  name: string;
  layer: OfficialMapLayer;
  areaType: string | null;
  officialOperatorName: string | null;
  externalId: string | null;
  concessionId?: string | null;
  accountingUnit?: string | null;
  delomrade?: string | null;
};

export type OfficialMapFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id?: string;
    geometry: GeoJsonGeometry | null;
    properties: OfficialMapFeatureProperties;
  }>;
  truncated: boolean;
  featureCount: number;
  provenance: OfficialMapProvenance | null;
};

export type GeoJsonGeometry = {
  type: string;
  coordinates: unknown;
};

export type OfficialSpatialMatch = {
  projectId: string;
  localAreaId: string | null;
  nupAreaId: string | null;
};

export type OfficialSpatialSummary = {
  activeProjects: number;
  withCoordinates: number;
  localMatched: number;
  nupMatched: number;
  unmatched: number;
};

export type OfficialMapLayerVisibility = {
  projects: boolean;
  localNetwork: boolean;
  planningArea: boolean;
  opportunities: boolean;
  rejectedOpportunities: boolean;
};

export const DEFAULT_OFFICIAL_MAP_LAYERS: OfficialMapLayerVisibility = {
  projects: true,
  localNetwork: true,
  planningArea: true,
  opportunities: true,
  rejectedOpportunities: false,
};

export const OFFICIAL_MAP_OVERVIEW_MAX_ZOOM = 6;
export const OFFICIAL_MAP_FILL_MIN_ZOOM = OFFICIAL_MAP_OVERVIEW_MAX_ZOOM;

export type OfficialMapBbox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type OfficialMapSimplifyBand = "overview" | "mid" | "near";

export type OfficialMapAreaPreview = {
  areaId: string;
  layer: OfficialMapLayer;
  name: string | null;
  officialOperatorName: string | null;
  concessionId: string | null;
  accountingUnit: string | null;
  delomrade: string | null;
  externalId: string | null;
};

export function officialMapSimplifyBand(zoom: number): OfficialMapSimplifyBand {
  if (zoom < OFFICIAL_MAP_OVERVIEW_MAX_ZOOM) return "overview";
  if (zoom < 9) return "mid";
  return "near";
}

export function officialMapSimplifyTolerance(zoom: number | null | undefined): number {
  if (zoom == null || zoom < OFFICIAL_MAP_OVERVIEW_MAX_ZOOM) return 0.02;
  if (zoom < 9) return 0.008;
  return 0.002;
}

export function officialMapViewportFetchKey(input: {
  zoom: number;
  west: number;
  south: number;
  east: number;
  north: number;
}): string | null {
  if (input.zoom < OFFICIAL_MAP_OVERVIEW_MAX_ZOOM) return null;
  const decimals = input.zoom < 9 ? 1 : 2;
  const round = (value: number) => value.toFixed(decimals);
  const band = input.zoom < 9 ? "mid" : "near";
  return `${band}:${round(input.west)},${round(input.south)},${round(input.east)},${round(input.north)}`;
}

function clampOfficialMapBbox(bbox: OfficialMapBbox): OfficialMapBbox {
  const west = Math.min(Math.max(bbox.west, SWEDEN_MAP_BOUNDS.west - 1), SWEDEN_MAP_BOUNDS.east);
  const south = Math.min(Math.max(bbox.south, SWEDEN_MAP_BOUNDS.south - 1), SWEDEN_MAP_BOUNDS.north);
  const east = Math.min(Math.max(bbox.east, SWEDEN_MAP_BOUNDS.west), SWEDEN_MAP_BOUNDS.east + 1);
  const north = Math.min(Math.max(bbox.north, SWEDEN_MAP_BOUNDS.south), SWEDEN_MAP_BOUNDS.north + 1);
  if (west >= east || south >= north) {
    return { ...SWEDEN_MAP_BOUNDS };
  }
  return { west, south, east, north };
}

export function expandOfficialMapBbox(bbox: OfficialMapBbox, zoom: number): OfficialMapBbox {
  const pad = zoom < 9 ? 0.65 : 0.22;
  return clampOfficialMapBbox({
    west: bbox.west - pad,
    south: bbox.south - pad,
    east: bbox.east + pad,
    north: bbox.north + pad,
  });
}

export function officialMapBboxContains(outer: OfficialMapBbox, inner: OfficialMapBbox): boolean {
  return (
    outer.west <= inner.west &&
    outer.south <= inner.south &&
    outer.east >= inner.east &&
    outer.north >= inner.north
  );
}

export type OfficialMapCachedViewport = {
  key: string;
  band: Exclude<OfficialMapSimplifyBand, "overview">;
  bbox: OfficialMapBbox;
};

export type OfficialMapViewportDecision =
  | { action: "overview" }
  | { action: "keep" }
  | {
      action: "fetch";
      key: string;
      band: Exclude<OfficialMapSimplifyBand, "overview">;
      requestBbox: OfficialMapBbox;
    };

export function decideOfficialMapViewportFetch(input: {
  zoom: number;
  visible: OfficialMapBbox;
  cached: OfficialMapCachedViewport | null;
}): OfficialMapViewportDecision {
  const band = officialMapSimplifyBand(input.zoom);
  if (band === "overview") {
    return { action: "overview" };
  }
  if (
    input.cached &&
    input.cached.band === band &&
    officialMapBboxContains(input.cached.bbox, input.visible)
  ) {
    return { action: "keep" };
  }
  const requestBbox = expandOfficialMapBbox(input.visible, input.zoom);
  const key =
    officialMapViewportFetchKey({ zoom: input.zoom, ...requestBbox }) ?? `${band}:buffered`;
  return { action: "fetch", key, band, requestBbox };
}

export function shouldApplyOfficialMapResponse(
  requestGeneration: number,
  latestGeneration: number,
): boolean {
  return requestGeneration === latestGeneration && requestGeneration > 0;
}

export function shouldReplaceOfficialMapSource(collection: OfficialMapFeatureCollection): boolean {
  return collection.features.length > 0;
}

export function officialMapAreaPreviewFromProperties(
  properties: Record<string, unknown> | null | undefined,
  featureId?: string | number | null,
  fallbackLayer: OfficialMapLayer = "local_network",
): OfficialMapAreaPreview | null {
  const props = properties ?? {};
  const areaId =
    (typeof props.id === "string" && props.id) || (typeof featureId === "string" ? featureId : null);
  if (!areaId) return null;
  const layer: OfficialMapLayer =
    props.layer === "planning_area"
      ? "planning_area"
      : props.layer === "local_network"
        ? "local_network"
        : fallbackLayer;
  return {
    areaId,
    layer,
    name: typeof props.name === "string" ? props.name : null,
    officialOperatorName:
      typeof props.officialOperatorName === "string" ? props.officialOperatorName : null,
    concessionId: typeof props.concessionId === "string" ? props.concessionId : null,
    accountingUnit: typeof props.accountingUnit === "string" ? props.accountingUnit : null,
    delomrade: typeof props.delomrade === "string" ? props.delomrade : null,
    externalId: typeof props.externalId === "string" ? props.externalId : null,
  };
}

export function officialMapAreaPreviewShell(input: {
  areaId: string;
  layer: OfficialMapLayer;
}): OfficialMapAreaPreview {
  return {
    areaId: input.areaId,
    layer: input.layer,
    name: null,
    officialOperatorName: null,
    concessionId: null,
    accountingUnit: null,
    delomrade: null,
    externalId: null,
  };
}

export function isOfficialMapLayer(value: string | null | undefined): value is OfficialMapLayer {
  return value === "local_network" || value === "planning_area";
}

export function summarizeOfficialSpatialMatches(input: {
  activeProjects: number;
  plottableProjectIds: string[];
  matches: OfficialSpatialMatch[];
}): OfficialSpatialSummary {
  const matchByProject = new Map(input.matches.map((item) => [item.projectId, item]));
  let localMatched = 0;
  let nupMatched = 0;
  let unmatched = 0;
  for (const projectId of input.plottableProjectIds) {
    const match = matchByProject.get(projectId);
    const hasLocal = Boolean(match?.localAreaId);
    const hasNup = Boolean(match?.nupAreaId);
    if (hasLocal) localMatched += 1;
    if (hasNup) nupMatched += 1;
    if (!hasLocal || !hasNup) unmatched += 1;
  }
  return {
    activeProjects: input.activeProjects,
    withCoordinates: input.plottableProjectIds.length,
    localMatched,
    nupMatched,
    unmatched,
  };
}

export function isUnmatchedReviewProject(
  match: OfficialSpatialMatch | undefined,
  hasCoordinates: boolean,
): boolean {
  if (!hasCoordinates) return true;
  return !match?.localAreaId || !match?.nupAreaId;
}

export function coveringFeatureIds(match: OfficialSpatialMatch | undefined): string[] {
  return [match?.localAreaId, match?.nupAreaId].filter((id): id is string => Boolean(id));
}

export function officialMapCopyContainsForbiddenTerm(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of FORBIDDEN_CAPACITY_TERMS) {
    if (lower.includes(term)) {
      return term;
    }
  }
  return null;
}

export function unmatchedLocalNetworkCopy(input: {
  dataset: string;
  freshness: string | null;
  latitude: number | null;
  longitude: number | null;
  lastFullIngestAt: string | null;
  sourceHealth: string | null;
}): { title: string; body: string; details: string[] } {
  return {
    title: LOCAL_NETWORK_UNMATCHED_TITLE,
    body: LOCAL_NETWORK_UNMATCHED_BODY,
    details: unmatchedDetailLines(input),
  };
}

export function unmatchedNupCopy(input: {
  dataset: string;
  freshness: string | null;
  latitude: number | null;
  longitude: number | null;
  lastFullIngestAt: string | null;
  sourceHealth: string | null;
}): { title: string; body: string; details: string[] } {
  return {
    title: NUP_UNMATCHED_TITLE,
    body: NUP_UNMATCHED_BODY,
    details: unmatchedDetailLines(input),
  };
}

function unmatchedDetailLines(input: {
  dataset: string;
  freshness: string | null;
  latitude: number | null;
  longitude: number | null;
  lastFullIngestAt: string | null;
  sourceHealth: string | null;
}): string[] {
  const coordinate =
    input.latitude != null && input.longitude != null
      ? `${input.latitude.toFixed(4)}, ${input.longitude.toFixed(4)}`
      : "Not set";
  return [
    `Dataset: ${input.dataset}`,
    `Dataset freshness: ${input.freshness ?? "Unknown"}`,
    `Project coordinate: ${coordinate}`,
    `Last successful full ingest: ${input.lastFullIngestAt ?? "Unknown"}`,
    `Source status: ${input.sourceHealth ?? "Unknown"}`,
  ];
}

export function assertOfficialMapPayloadIsCustomerSafe(payload: unknown): void {
  const serialized = JSON.stringify(payload ?? {});
  if (serialized.includes("raw_content") || serialized.includes("rawContent")) {
    throw new Error("Official map payload must not include raw ingest content.");
  }
  if (serialized.includes("service_role") || serialized.includes("serviceRole")) {
    throw new Error("Official map payload must not include service-role material.");
  }
}

export function parseOfficialMapFeatureCollection(value: unknown): OfficialMapFeatureCollection {
  assertOfficialMapPayloadIsCustomerSafe(value);
  const record = asRecord(value);
  const features = Array.isArray(record.features)
    ? record.features
        .map(parseFeature)
        .filter((feature): feature is OfficialMapFeatureCollection["features"][number] => feature != null)
    : [];
  return {
    type: "FeatureCollection",
    features,
    truncated: record.truncated === true,
    featureCount: typeof record.featureCount === "number" ? record.featureCount : features.length,
    provenance: parseProvenance(record.provenance),
  };
}

export function officialMapContextLabel(input: {
  coveringName?: string | null;
  matched: boolean;
}): string {
  const name = input.coveringName?.trim();
  if (name) return name;
  return input.matched ? "Matched" : "No match";
}

export function parseOfficialSpatialMatches(value: unknown): OfficialSpatialMatch[] {
  assertOfficialMapPayloadIsCustomerSafe(value);
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = asRecord(item);
      const projectId = asString(row.projectId) ?? asString(row.project_id);
      if (!projectId) return null;
      return {
        projectId,
        localAreaId: asString(row.localAreaId) ?? asString(row.local_area_id),
        nupAreaId: asString(row.nupAreaId) ?? asString(row.nup_area_id),
      };
    })
    .filter((item): item is OfficialSpatialMatch => item != null);
}

function parseFeature(value: unknown): OfficialMapFeatureCollection["features"][number] | null {
  const row = asRecord(value);
  const properties = parseProperties(row.properties);
  if (!properties) return null;
  const geometry = row.geometry && typeof row.geometry === "object" ? (row.geometry as GeoJsonGeometry) : null;
  return {
    type: "Feature",
    id: typeof row.id === "string" ? row.id : properties.id,
    geometry,
    properties,
  };
}

function parseProperties(value: unknown): OfficialMapFeatureProperties | null {
  const row = asRecord(value);
  const id = asString(row.id);
  const name = asString(row.name);
  const layer = asString(row.layer);
  if (!id || !name || !isOfficialMapLayer(layer)) return null;
  return {
    id,
    name,
    layer,
    areaType: asString(row.areaType),
    officialOperatorName: asString(row.officialOperatorName),
    externalId: asString(row.externalId),
    concessionId: asString(row.concessionId),
    accountingUnit: asString(row.accountingUnit),
    delomrade: asString(row.delomrade),
  };
}

function parseProvenance(value: unknown): OfficialMapProvenance | null {
  const row = asRecord(value);
  const sourceId = asString(row.sourceId);
  const sourceName = asString(row.sourceName);
  const sourceSlug = asString(row.sourceSlug);
  if (!sourceId || !sourceName || !sourceSlug) return null;
  return {
    sourceId,
    sourceName,
    sourceSlug,
    publisher: asString(row.publisher),
    sourceUrl: asString(row.sourceUrl),
    publishedAt: asString(row.publishedAt),
    retrievedAt: asString(row.retrievedAt),
    authorityLevel: asString(row.authorityLevel),
    dataType: asString(row.dataType),
    planningPeriod: asString(row.planningPeriod),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
