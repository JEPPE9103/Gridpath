import { getCurrentOrganization } from "@/lib/data/organization";
import {
  SWEDEN_MAP_BOUNDS,
  parseOfficialMapFeatureCollection,
  parseOfficialSpatialMatches,
  type OfficialMapFeatureCollection,
  type OfficialMapLayer,
  type OfficialSpatialMatch,
} from "@/lib/domain/official-map";
import { logError } from "@/lib/observability/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OfficialMapBbox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type OfficialMapAreaContext = {
  id: string;
  name: string;
  layer: OfficialMapLayer;
  officialOperatorName: string | null;
  externalId: string | null;
  concessionId: string | null;
  accountingUnit: string | null;
  delomrade: string | null;
  projectCount: number | null;
  forecastTransferCapacityNeed: Array<{
    year: number;
    valueNumeric: number | null;
    valueText: string | null;
    unit: string | null;
    representation: string | null;
  }>;
  provenance: OfficialMapFeatureCollection["provenance"];
};

export type OfficialCoveringGeojson = {
  localNetwork: OfficialMapFeatureCollection["features"][number] | null;
  planningArea: OfficialMapFeatureCollection["features"][number] | null;
};

function emptyCollection(): OfficialMapFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
    truncated: false,
    featureCount: 0,
    provenance: null,
  };
}

export async function getOfficialMapLayerGeojson(
  layer: OfficialMapLayer,
  bbox: OfficialMapBbox = SWEDEN_MAP_BOUNDS,
  zoom = 4.35,
): Promise<OfficialMapFeatureCollection> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return emptyCollection();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_official_map_layer_geojson", {
    p_layer: layer,
    p_west: bbox.west,
    p_south: bbox.south,
    p_east: bbox.east,
    p_north: bbox.north,
    p_zoom: zoom,
  });
  if (error) {
    logError("official_map.layer_failed", { layer, message: error.message });
    return emptyCollection();
  }
  return parseOfficialMapFeatureCollection(data);
}

export async function getOrganizationOfficialSpatialMatches(): Promise<OfficialSpatialMatch[]> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return [];
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_organization_official_spatial_matches", {
    p_organization_id: organization.id,
  });
  if (error) {
    logError("official_map.matches_failed", { message: error.message });
    return [];
  }
  return parseOfficialSpatialMatches(data);
}

export async function getOfficialCoveringGeojsonForProject(
  projectId: string,
): Promise<OfficialCoveringGeojson> {
  const organization = await getCurrentOrganization();
  if (!organization || !projectId.trim()) {
    return { localNetwork: null, planningArea: null };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_official_covering_geojson_for_project", {
    p_project_id: projectId,
  });
  if (error) {
    logError("official_map.covering_failed", { message: error.message });
    return { localNetwork: null, planningArea: null };
  }
  const record = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  const local = parseOfficialMapFeatureCollection({
    type: "FeatureCollection",
    features: record.localNetwork ? [record.localNetwork] : [],
  }).features[0] ?? null;
  const nup = parseOfficialMapFeatureCollection({
    type: "FeatureCollection",
    features: record.planningArea ? [record.planningArea] : [],
  }).features[0] ?? null;
  return { localNetwork: local, planningArea: nup };
}

export async function getOfficialMapAreaContext(
  areaId: string,
): Promise<OfficialMapAreaContext | null> {
  const organization = await getCurrentOrganization();
  if (!organization || !areaId.trim()) {
    return null;
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_official_map_area_context", {
    p_area_id: areaId,
    p_organization_id: organization.id,
  });
  if (error) {
    logError("official_map.area_failed", { message: error.message });
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const row = data as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id : null;
  const name = typeof row.name === "string" ? row.name : null;
  const layer = row.layer === "local_network" || row.layer === "planning_area" ? row.layer : null;
  if (!id || !name || !layer) {
    return null;
  }
  const forecasts = Array.isArray(row.forecastTransferCapacityNeed)
    ? row.forecastTransferCapacityNeed.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const obs = item as Record<string, unknown>;
        const year = typeof obs.year === "number" ? obs.year : Number(obs.year);
        if (!Number.isFinite(year)) return [];
        return [
          {
            year,
            valueNumeric:
              typeof obs.valueNumeric === "number"
                ? obs.valueNumeric
                : typeof obs.valueNumeric === "string"
                  ? Number(obs.valueNumeric)
                  : null,
            valueText: typeof obs.valueText === "string" ? obs.valueText : null,
            unit: typeof obs.unit === "string" ? obs.unit : null,
            representation: typeof obs.representation === "string" ? obs.representation : null,
          },
        ];
      })
    : [];
  const provenanceCollection = parseOfficialMapFeatureCollection({
    type: "FeatureCollection",
    features: [],
    provenance: row.provenance,
  });
  return {
    id,
    name,
    layer,
    officialOperatorName: typeof row.officialOperatorName === "string" ? row.officialOperatorName : null,
    externalId: typeof row.externalId === "string" ? row.externalId : null,
    concessionId: typeof row.concessionId === "string" ? row.concessionId : null,
    accountingUnit: typeof row.accountingUnit === "string" ? row.accountingUnit : null,
    delomrade: typeof row.delomrade === "string" ? row.delomrade : null,
    projectCount: typeof row.projectCount === "number" ? row.projectCount : null,
    forecastTransferCapacityNeed: forecasts.map((item) => ({
      ...item,
      valueNumeric: item.valueNumeric != null && Number.isFinite(item.valueNumeric) ? item.valueNumeric : null,
    })),
    provenance: provenanceCollection.provenance,
  };
}
