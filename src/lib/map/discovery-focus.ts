import type { SearchBbox } from "@/lib/opportunities/spatial-screening";

export const DISCOVERY_FIT_DURATION_MS = 750;
export const DISCOVERY_FIT_MAX_ZOOM = 11;
export const DISCOVERY_FIT_MIN_SPAN_DEG = 0.12;

export type DiscoveryFitPadding = number | { top: number; right: number; bottom: number; left: number };

export function expandBboxForDiscoveryFit(bbox: SearchBbox, minSpan = DISCOVERY_FIT_MIN_SPAN_DEG): SearchBbox {
  const width = bbox.east - bbox.west;
  const height = bbox.north - bbox.south;
  const padX = Math.max(0, (minSpan - width) / 2);
  const padY = Math.max(0, (minSpan - height) / 2);
  const expanded = {
    west: bbox.west - padX,
    south: bbox.south - padY,
    east: bbox.east + padX,
    north: bbox.north + padY,
  };
  // Guard float drift so tiny Search Areas still meet the minimum visible span.
  if (expanded.east - expanded.west < minSpan) {
    const mid = (expanded.west + expanded.east) / 2;
    expanded.west = mid - minSpan / 2;
    expanded.east = mid + minSpan / 2;
  }
  if (expanded.north - expanded.south < minSpan) {
    const mid = (expanded.south + expanded.north) / 2;
    expanded.south = mid - minSpan / 2;
    expanded.north = mid + minSpan / 2;
  }
  return expanded;
}

export function shouldRefitDiscoveryRun(previousKey: string | null | undefined, nextKey: string | null | undefined): boolean {
  if (!nextKey) return false;
  return previousKey !== nextKey;
}

export function discoveryFitBoundsInput(bbox: SearchBbox, padding: DiscoveryFitPadding) {
  const expanded = expandBboxForDiscoveryFit(bbox);
  return {
    bounds: [
      [expanded.west, expanded.south],
      [expanded.east, expanded.north],
    ] as [[number, number], [number, number]],
    options: {
      padding,
      maxZoom: DISCOVERY_FIT_MAX_ZOOM,
      duration: DISCOVERY_FIT_DURATION_MS,
    },
  };
}
