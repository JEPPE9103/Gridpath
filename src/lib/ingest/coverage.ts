import {
  CONTAMINATION_SOURCE_SLUG,
  COPERNICUS_SOURCE_SLUG,
  FLOOD_SOURCE_SLUG,
  GROUND_SOURCE_SLUG,
  NMD_SOURCE_SLUG,
  ROADLINK_SOURCE_SLUG,
  needsOnDemandFetch,
  type CoverageStatus,
} from "@/lib/ingest/coverage-keys";
import type { SearchBbox } from "@/lib/opportunities/spatial-screening";

export type CatalogCoverageScope = "bbox" | "national_catalog";

export type LayerCoverage = {
  status: CoverageStatus;
  scope: CatalogCoverageScope;
  intersectingSummaries?: number;
  intersectingFeatures?: number;
  fetchedAt?: string | null;
};

export type SearchAreaCoverage = {
  bbox: SearchBbox;
  areaKm2: number;
  nmd: LayerCoverage;
  copernicus: LayerCoverage;
  roadlink: LayerCoverage;
  flood: LayerCoverage;
  ground: LayerCoverage;
  contamination: LayerCoverage;
  protectedAreas: LayerCoverage;
  natura2000: LayerCoverage;
  eiNetworkAreas: LayerCoverage;
  nup: LayerCoverage;
};

const EMPTY_LAYER: LayerCoverage = { status: "missing", scope: "bbox" };
const EMPTY_CATALOG: LayerCoverage = { status: "missing", scope: "national_catalog" };

function asStatus(value: unknown): CoverageStatus {
  if (value === "covered" || value === "partial" || value === "missing" || value === "stale") {
    return value;
  }
  return "missing";
}

function asLayer(value: unknown, fallback: LayerCoverage): LayerCoverage {
  if (!value || typeof value !== "object") return fallback;
  const row = value as Record<string, unknown>;
  return {
    status: asStatus(row.status),
    scope: row.scope === "national_catalog" ? "national_catalog" : "bbox",
    intersectingSummaries: typeof row.intersectingSummaries === "number" ? row.intersectingSummaries : undefined,
    intersectingFeatures: typeof row.intersectingFeatures === "number" ? row.intersectingFeatures : undefined,
    fetchedAt: typeof row.fetchedAt === "string" ? row.fetchedAt : null,
  };
}

export function parseSearchAreaCoverage(value: unknown): SearchAreaCoverage | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const bbox = row.bbox as SearchBbox | undefined;
  if (
    !bbox ||
    ![bbox.west, bbox.south, bbox.east, bbox.north].every((item) => typeof item === "number" && Number.isFinite(item))
  ) {
    return null;
  }
  return {
    bbox,
    areaKm2: typeof row.areaKm2 === "number" ? row.areaKm2 : 0,
    nmd: asLayer(row.nmd, EMPTY_LAYER),
    copernicus: asLayer(row.copernicus, EMPTY_LAYER),
    roadlink: asLayer(row.roadlink, EMPTY_LAYER),
    flood: asLayer(row.flood, EMPTY_LAYER),
    ground: asLayer(row.ground, EMPTY_LAYER),
    contamination: asLayer(row.contamination ?? row.environmentalHistory, EMPTY_LAYER),
    protectedAreas: asLayer(row.protectedAreas, EMPTY_CATALOG),
    natura2000: asLayer(row.natura2000, EMPTY_CATALOG),
    eiNetworkAreas: asLayer(row.eiNetworkAreas, EMPTY_CATALOG),
    nup: asLayer(row.nup, EMPTY_CATALOG),
  };
}

export type OnDemandSourcePlan = {
  slug:
    | typeof NMD_SOURCE_SLUG
    | typeof COPERNICUS_SOURCE_SLUG
    | typeof ROADLINK_SOURCE_SLUG
    | typeof FLOOD_SOURCE_SLUG
    | typeof GROUND_SOURCE_SLUG
    | typeof CONTAMINATION_SOURCE_SLUG;
  fetch: boolean;
  status: CoverageStatus;
};

export function onDemandSourcePlan(coverage: SearchAreaCoverage): OnDemandSourcePlan[] {
  return [
    { slug: NMD_SOURCE_SLUG, fetch: needsOnDemandFetch(coverage.nmd.status), status: coverage.nmd.status },
    {
      slug: COPERNICUS_SOURCE_SLUG,
      fetch: needsOnDemandFetch(coverage.copernicus.status),
      status: coverage.copernicus.status,
    },
    {
      slug: ROADLINK_SOURCE_SLUG,
      fetch: needsOnDemandFetch(coverage.roadlink.status),
      status: coverage.roadlink.status,
    },
    {
      slug: FLOOD_SOURCE_SLUG,
      fetch: needsOnDemandFetch(coverage.flood.status),
      status: coverage.flood.status,
    },
    {
      slug: GROUND_SOURCE_SLUG,
      fetch: needsOnDemandFetch(coverage.ground.status),
      status: coverage.ground.status,
    },
    {
      slug: CONTAMINATION_SOURCE_SLUG,
      fetch: needsOnDemandFetch(coverage.contamination.status),
      status: coverage.contamination.status,
    },
  ];
}

export function coverageGapMessage(slug: string, reason: string): string {
  if (slug === ROADLINK_SOURCE_SLUG) {
    return `Road evidence unavailable — screening continued with reduced evidence. ${reason}`.trim();
  }
  if (slug === NMD_SOURCE_SLUG) {
    return `Land-cover evidence unavailable — screening continued with reduced evidence. ${reason}`.trim();
  }
  if (slug === COPERNICUS_SOURCE_SLUG) {
    return `Terrain evidence unavailable — screening continued with reduced evidence. ${reason}`.trim();
  }
  if (slug === FLOOD_SOURCE_SLUG) {
    return `Flood/water evidence unavailable — screening continued with reduced evidence. ${reason}`.trim();
  }
  if (slug === GROUND_SOURCE_SLUG) {
    return `Ground/soil evidence unavailable — screening continued with reduced evidence. ${reason}`.trim();
  }
  if (slug === CONTAMINATION_SOURCE_SLUG) {
    return `Environmental-history evidence unavailable — screening continued with reduced evidence. ${reason}`.trim();
  }
  return `Official evidence unavailable — screening continued with reduced evidence. ${reason}`.trim();
}

export function assertGapDoesNotClaimAbsence(message: string): boolean {
  return !/no road issue|no terrain issue|no land-cover issue|roads are fine/i.test(message);
}
