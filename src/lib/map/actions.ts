"use server";

import { getMapDiscoveryRun } from "@/lib/data/map-discovery";
import {
  getOfficialCoveringLoad,
  getOfficialMapAreaContext,
  getOfficialMapLayerLoad,
  type OfficialMapBbox,
} from "@/lib/data/official-map";
import { isOfficialMapLayer } from "@/lib/domain/official-map";

export async function loadOfficialMapLayerAction(input: {
  layer: string;
  bbox: OfficialMapBbox;
  zoom: number;
}) {
  if (!isOfficialMapLayer(input.layer)) {
    return {
      ok: false as const,
      status: "unavailable" as const,
      error: "Unknown official layer.",
      collection: {
        type: "FeatureCollection" as const,
        features: [],
        truncated: false,
        featureCount: 0,
        provenance: null,
      },
    };
  }
  const loaded = await getOfficialMapLayerLoad(input.layer, input.bbox, input.zoom);
  return {
    ok: loaded.status === "available",
    status: loaded.status,
    collection: loaded.collection,
  };
}

export async function loadOfficialMapAreaContextAction(areaId: string) {
  const context = await getOfficialMapAreaContext(areaId);
  if (!context) {
    return { ok: false as const, error: "Could not load official area." };
  }
  return { ok: true as const, context };
}

export async function loadOfficialCoveringAction(projectId: string) {
  const loaded = await getOfficialCoveringLoad(projectId);
  return {
    ok: loaded.status === "available",
    status: loaded.status,
    covering: loaded.covering,
  };
}

export async function loadMapDiscoveryRunAction(searchId: string, runId: string) {
  if (!searchId.trim() || !runId.trim()) {
    return { ok: false as const, error: "Select a completed search run." };
  }
  const payload = await getMapDiscoveryRun(searchId, runId);
  if (!payload) {
    return { ok: false as const, error: "Could not load that screening run." };
  }
  return { ok: true as const, payload };
}
