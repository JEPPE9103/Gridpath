import type { OfficialMapFeatureCollection, OfficialMapLayer } from "@/lib/domain/official-map";

const MAX_LAYER_ENTRIES = 12;
const MAX_CONTEXT_ENTRIES = 24;

const layerCache = new Map<string, OfficialMapFeatureCollection>();
const coveringCache = new Map<string, unknown>();
const areaContextCache = new Map<string, unknown>();

function touchSet<T>(store: Map<string, T>, key: string, value: T, max: number) {
  if (store.has(key)) store.delete(key);
  store.set(key, value);
  while (store.size > max) {
    const oldest = store.keys().next().value;
    if (oldest == null) break;
    store.delete(oldest);
  }
}

export function officialGeometryCacheKey(layer: OfficialMapLayer, fetchKey: string): string {
  return `${layer}:${fetchKey}`;
}

export function getCachedOfficialGeometry(key: string): OfficialMapFeatureCollection | null {
  const hit = layerCache.get(key);
  if (!hit || hit.features.length === 0) return null;
  layerCache.delete(key);
  layerCache.set(key, hit);
  return hit;
}

export function setCachedOfficialGeometry(key: string, collection: OfficialMapFeatureCollection) {
  if (collection.features.length === 0) return;
  touchSet(layerCache, key, collection, MAX_LAYER_ENTRIES);
}

export function peekCachedValue<T>(store: "covering" | "area", key: string): T | null {
  const map = store === "covering" ? coveringCache : areaContextCache;
  const hit = map.get(key);
  return hit == null ? null : (hit as T);
}

export function getCachedValue<T>(store: "covering" | "area", key: string): T | null {
  const map = store === "covering" ? coveringCache : areaContextCache;
  const hit = map.get(key);
  if (hit == null) return null;
  map.delete(key);
  map.set(key, hit);
  return hit as T;
}

export function setCachedValue<T>(store: "covering" | "area", key: string, value: T) {
  const map = store === "covering" ? coveringCache : areaContextCache;
  touchSet(map, key, value, MAX_CONTEXT_ENTRIES);
}

export function resetOfficialGeometryCachesForTests() {
  layerCache.clear();
  coveringCache.clear();
  areaContextCache.clear();
}
