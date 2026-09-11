export type MapGeoJsonGeometry = {
  type: string;
  coordinates: unknown;
};

export type MapGeoJsonFeature = {
  type: "Feature";
  id?: string;
  geometry: MapGeoJsonGeometry | null;
  properties: Record<string, unknown>;
};

export type MapGeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: MapGeoJsonFeature[];
};

export type MapDiscoverySearch = {
  searchId: string;
  name: string;
  createdAt: string;
  latestRunId: string | null;
  latestRunStatus: string | null;
  returnedCount: number | null;
  west: number | null;
  south: number | null;
  east: number | null;
  north: number | null;
};

export type MapSearchArea = {
  id: string;
  name: string;
  searchId: string;
  west: number;
  south: number;
  east: number;
  north: number;
};

export const EMPTY_DISCOVERY_GEOJSON: MapGeoJsonFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export function parseAreaGeometry(value: unknown): MapGeoJsonGeometry | null {
  if (typeof value === "string") {
    try {
      return parseAreaGeometry(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const record = value as { type?: unknown; coordinates?: unknown; geometry?: unknown };
  if (record.geometry && typeof record.geometry === "object") {
    return parseAreaGeometry(record.geometry);
  }
  if (typeof record.type !== "string" || record.coordinates == null) return null;
  if (record.type !== "Polygon" && record.type !== "MultiPolygon") return null;
  return { type: record.type, coordinates: record.coordinates };
}

export function parseDiscoveryFeatureCollection(value: unknown): MapGeoJsonFeatureCollection {
  if (!value || typeof value !== "object") return EMPTY_DISCOVERY_GEOJSON;
  const record = value as { type?: unknown; features?: unknown };
  if (record.type !== "FeatureCollection" || !Array.isArray(record.features)) {
    return EMPTY_DISCOVERY_GEOJSON;
  }
  const features = record.features.flatMap((item): MapGeoJsonFeature[] => {
    if (!item || typeof item !== "object") return [];
    const feature = item as {
      type?: unknown;
      id?: unknown;
      geometry?: unknown;
      properties?: unknown;
    };
    if (feature.type !== "Feature") return [];
    const geometry =
      feature.geometry && typeof feature.geometry === "object"
        ? (feature.geometry as MapGeoJsonGeometry)
        : null;
    const properties =
      feature.properties && typeof feature.properties === "object"
        ? (feature.properties as Record<string, unknown>)
        : {};
    return [
      {
        type: "Feature",
        id: typeof feature.id === "string" ? feature.id : undefined,
        geometry,
        properties,
      },
    ];
  });
  return { type: "FeatureCollection", features };
}

export function discoveryGeographyLabel(search: Pick<MapDiscoverySearch, "west" | "south" | "east" | "north">): string {
  if (search.west == null || search.south == null || search.east == null || search.north == null) {
    return "Area not stored";
  }
  return `${search.south.toFixed(2)}–${search.north.toFixed(2)}N · ${search.west.toFixed(2)}–${search.east.toFixed(2)}E`;
}

export function discoveryRunStatusLabel(status: string | null | undefined): string {
  if (!status) return "No run";
  if (status === "completed" || status === "complete") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "preparing" || status === "generating_cells" || status === "evaluating_layers" || status === "ranking") {
    return "Running";
  }
  return status;
}

export function isCompletedDiscoveryRun(status: string | null | undefined): boolean {
  return status === "completed" || status === "complete";
}

export function opportunityFootprintFilter(showSaved: boolean, showRejected: boolean): unknown {
  if (showSaved && showRejected) return ["has", "slug"];
  if (showSaved) return ["!=", ["get", "footprintStyle"], "rejected"];
  if (showRejected) return ["==", ["get", "footprintStyle"], "rejected"];
  return ["==", ["get", "slug"], ""];
}

export function opportunityFootprintsCollection(
  items: Array<{
    slug: string;
    name: string;
    status: string;
    areaGeometry: MapGeoJsonGeometry | null;
    promotedProjectId?: string | null;
  }>,
): MapGeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: items.flatMap((item) => {
      if (!item.areaGeometry || isPromotedMapOpportunity(item)) return [];
      return [
        {
          type: "Feature" as const,
          id: item.slug,
          geometry: item.areaGeometry,
          properties: {
            slug: item.slug,
            name: item.name,
            status: item.status,
            footprintStyle: opportunityFootprintStyle(item.status),
            kind: "opportunity-footprint",
            id: item.slug,
          },
        },
      ];
    }),
  };
}

export function searchAreaBboxCollection(area: MapSearchArea | null): MapGeoJsonFeatureCollection {
  if (!area) return EMPTY_DISCOVERY_GEOJSON;
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id: area.id,
        properties: { id: area.id, name: area.name, kind: "search-boundary", searchId: area.searchId },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [area.west, area.south],
              [area.east, area.south],
              [area.east, area.north],
              [area.west, area.north],
              [area.west, area.south],
            ],
          ],
        },
      },
    ],
  };
}

export function screeningLayerFilter(showSites: boolean, showZones: boolean): unknown {
  if (showSites && showZones) {
    return ["any", ["==", ["get", "candidateKind"], "site"], ["==", ["get", "candidateKind"], "zone"]];
  }
  if (showSites) return ["==", ["get", "candidateKind"], "site"];
  if (showZones) return ["==", ["get", "candidateKind"], "zone"];
  return ["==", ["get", "id"], ""];
}

export function opportunityFootprintStyle(status: string): "saved" | "shortlisted" | "rejected" | "promoted" {
  if (status === "rejected") return "rejected";
  if (status === "promoted") return "promoted";
  if (status === "shortlisted" || status === "strong_candidate") return "shortlisted";
  return "saved";
}

export function isPromotedMapOpportunity(item: { status: string; promotedProjectId?: string | null }): boolean {
  return item.status === "promoted" || Boolean(item.promotedProjectId);
}

export const CANDIDATE_MAP_EXACT_PAD_PX = 2;
export const CANDIDATE_MAP_HIT_PAD_PX = 20;
export const FOOTPRINT_MAP_HIT_PAD_PX = 12;

type RankedMapHit = {
  id: string;
  rank: number | null;
};

function rankedHitsFromFeatures(
  features: Array<{ properties?: Record<string, unknown> | null }>,
  idKey: string,
): RankedMapHit[] {
  const items: RankedMapHit[] = [];
  const seen = new Set<string>();
  for (const feature of features) {
    const id = feature.properties?.[idKey];
    if (typeof id !== "string" || !id || seen.has(id)) continue;
    seen.add(id);
    const raw = feature.properties?.rank;
    const numeric = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
    items.push({ id, rank: Number.isFinite(numeric) ? numeric : null });
  }
  return items;
}

export function pickRankedMapFeatureId(
  features: Array<{ properties?: Record<string, unknown> | null }>,
  options?: { idKey?: string; preferredId?: string | null },
): string | null {
  const idKey = options?.idKey ?? "id";
  const items = rankedHitsFromFeatures(features, idKey);
  if (items.length === 0) return null;
  const preferred = options?.preferredId;
  if (preferred && items.some((item) => item.id === preferred)) return preferred;
  if (items.every((item) => item.rank != null)) {
    return [...items].sort((left, right) => (left.rank as number) - (right.rank as number))[0]?.id ?? null;
  }
  return items[0]?.id ?? null;
}

export function discoveryRunOptionLabel(search: { name: string; createdAt: string }): string {
  const date = new Date(search.createdAt);
  if (Number.isNaN(date.getTime())) return search.name;
  const stamp = `${date.getDate()} ${date.toLocaleString("en-GB", { month: "short" })} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${search.name} · ${stamp}`;
}
