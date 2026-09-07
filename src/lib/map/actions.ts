"use server";

import {
  getOfficialCoveringGeojsonForProject,
  getOfficialMapAreaContext,
  getOfficialMapLayerGeojson,
  type OfficialMapBbox,
} from "@/lib/data/official-map";
import { isOfficialMapLayer } from "@/lib/domain/official-map";

export async function loadOfficialMapLayerAction(input: {
  layer: string;
  bbox: OfficialMapBbox;
  zoom: number;
}) {
  if (!isOfficialMapLayer(input.layer)) {
    return { ok: false as const, error: "Unknown official layer." };
  }
  const collection = await getOfficialMapLayerGeojson(input.layer, input.bbox, input.zoom);
  return { ok: true as const, collection };
}

export async function loadOfficialMapAreaContextAction(areaId: string) {
  const context = await getOfficialMapAreaContext(areaId);
  if (!context) {
    return { ok: false as const, error: "Could not load official area." };
  }
  return { ok: true as const, context };
}

export async function loadOfficialCoveringAction(projectId: string) {
  const covering = await getOfficialCoveringGeojsonForProject(projectId);
  return { ok: true as const, covering };
}
