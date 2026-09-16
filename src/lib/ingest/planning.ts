/**
 * Malmö stad — Gällande detaljplaner (ArcGIS REST MapServer).
 * Official public GeoJSON query; EPSG:3008 native, outSR=4326.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PLANNING_SOURCE_SLUG } from "@/lib/ingest/coverage-keys";
import { fetchOpenGeodataText } from "@/lib/ingest/open-geodata";
import { MALMO_GALLANDE_QUERY_ENDPOINT, PLANNING_PROVIDER_KEY_MALMO } from "@/lib/opportunities/planning-providers";
import {
  PLANNING_NORMALIZE_VERSION,
  normalizeMalmoPlanRecord,
} from "@/lib/opportunities/planning";
import type { SearchBbox } from "@/lib/opportunities/spatial-screening";

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
const FETCH_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 2;
/** Provenance fields only; geometry dominates payload — avoid outFields=*. */
const MALMO_OUT_FIELDS =
  "OBJECTID,PLAN_,PLANID,PLANNAMN,LAGAKRAFT_,FIX_LAGAKR,BESLUTSDAT,LMAKT,url_dok,url_1,url_2,url_ovrig";

export type PlanningFeatureRow = {
  id: string;
  name: string;
  designation: string;
  geom: Record<string, unknown>;
  properties: Record<string, unknown>;
  clipWest?: number;
  clipSouth?: number;
  clipEast?: number;
  clipNorth?: number;
  sourceVersion?: string;
};

type ArcGisFeature = {
  id?: string | number;
  properties?: Record<string, unknown>;
  geometry?: Record<string, unknown>;
};

function cacheDir(): string {
  const root = process.env.NOXHEIM_GEODATA_CACHE?.trim() || path.join(tmpdir(), "noxheim-geodata");
  mkdirSync(root, { recursive: true });
  return root;
}

function windowCacheKey(bbox: SearchBbox): string {
  return `malmo-plan:${bbox.west.toFixed(4)}:${bbox.south.toFixed(4)}:${bbox.east.toFixed(4)}:${bbox.north.toFixed(4)}`;
}

function readDiskCache(bbox: SearchBbox): PlanningFeatureRow[] | null {
  const file = path.join(cacheDir(), `${windowCacheKey(bbox).replace(/:/g, "_")}.json`);
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as { rows?: PlanningFeatureRow[] };
    return Array.isArray(parsed.rows) ? parsed.rows : null;
  } catch {
    return null;
  }
}

function writeDiskCache(bbox: SearchBbox, rows: PlanningFeatureRow[]): void {
  const file = path.join(cacheDir(), `${windowCacheKey(bbox).replace(/:/g, "_")}.json`);
  writeFileSync(file, JSON.stringify({ rows, cachedAt: new Date().toISOString() }));
}

export function buildMalmoPlanningQueryUrl(
  bbox: SearchBbox,
  resultOffset = 0,
  resultRecordCount = PAGE_SIZE,
  inSr: 4326 | 3008 = 4326,
): string {
  const url = new URL(MALMO_GALLANDE_QUERY_ENDPOINT);
  url.searchParams.set("f", "geojson");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("outFields", MALMO_OUT_FIELDS);
  url.searchParams.set("where", "1=1");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("geometryType", "esriGeometryEnvelope");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("inSR", String(inSr));
  url.searchParams.set("geometry", `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`);
  url.searchParams.set("resultOffset", String(resultOffset));
  url.searchParams.set("resultRecordCount", String(resultRecordCount));
  // NOTE: ArcGIS maxAllowableOffset (~10 m) cut payload ~10× in profiling, but
  // generalized polygons can fail PostGIS ST_Intersection (TopologyException).
  // Keep full official geometry until upsert makevalid-before-clip is shipped.
  return url.href;
}

function asMultiPolygon(geom: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!geom || typeof geom.type !== "string") return null;
  if (geom.type === "Polygon" || geom.type === "MultiPolygon") return geom;
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseFeatureCollection(text: string): {
  features: ArcGisFeature[];
  exceededTransferLimit?: boolean;
} {
  const parsed = JSON.parse(text) as {
    features?: unknown;
    exceededTransferLimit?: boolean;
    properties?: { exceededTransferLimit?: boolean };
  };
  const features = Array.isArray(parsed.features) ? (parsed.features as ArcGisFeature[]) : [];
  const exceeded =
    parsed.exceededTransferLimit === true || parsed.properties?.exceededTransferLimit === true;
  return { features, exceededTransferLimit: exceeded };
}

async function fetchPlanningPage(
  bbox: SearchBbox,
  resultOffset: number,
): Promise<ReturnType<typeof parseFeatureCollection>> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      // Prefer WGS84 envelope (matches Search Area). Retry EPSG:3008 only when 4326 fails.
      const text = await fetchOpenGeodataText(
        buildMalmoPlanningQueryUrl(bbox, resultOffset, PAGE_SIZE, 4326),
        FETCH_TIMEOUT_MS,
      );
      return parseFeatureCollection(text);
    } catch (error4326) {
      try {
        const text = await fetchOpenGeodataText(
          buildMalmoPlanningQueryUrl(bbox, resultOffset, PAGE_SIZE, 3008),
          FETCH_TIMEOUT_MS,
        );
        return parseFeatureCollection(text);
      } catch (error3008) {
        lastError = error3008 ?? error4326;
        if (attempt < MAX_ATTEMPTS) await sleep(400 * attempt);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Malmö planning fetch failed");
}

function featureExternalId(feature: ArcGisFeature, normalizedPlanId: string, bbox: SearchBbox): string {
  const props = feature.properties ?? {};
  const objectId = props.OBJECTID ?? props.objectid ?? feature.id;
  const base =
    normalizedPlanId !== "unknown"
      ? normalizedPlanId
      : objectId != null && String(objectId).trim()
        ? String(objectId).trim()
        : createHash("sha1").update(JSON.stringify(props)).digest("hex").slice(0, 16);
  return `malmo-plan:${base}:${bbox.west.toFixed(4)}:${bbox.south.toFixed(4)}`;
}

export function planningSnapshotHash(bbox: SearchBbox, featureCount: number): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        source: PLANNING_SOURCE_SLUG,
        provider: PLANNING_PROVIDER_KEY_MALMO,
        normalize: PLANNING_NORMALIZE_VERSION,
        bbox,
        featureCount,
      }),
    )
    .digest("hex");
}

export async function fetchPlanningFeatures(bbox: SearchBbox): Promise<PlanningFeatureRow[]> {
  const cached = readDiskCache(bbox);
  if (cached) return cached;

  const rows: PlanningFeatureRow[] = [];
  let resultOffset = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { features, exceededTransferLimit } = await fetchPlanningPage(bbox, resultOffset);
    for (const feature of features) {
      const geom = asMultiPolygon(feature.geometry);
      if (!geom) continue;
      const props = feature.properties ?? {};
      const normalized = normalizeMalmoPlanRecord(props);
      if (!normalized.planId || normalized.planId === "unknown") continue;
      rows.push({
        id: featureExternalId(feature, normalized.planId, bbox),
        name: normalized.planName ?? `Plan ${normalized.planId}`,
        designation: normalized.planStatus ?? "Gällande",
        geom,
        properties: {
          ...props,
          normalizeVersion: PLANNING_NORMALIZE_VERSION,
          providerKey: PLANNING_PROVIDER_KEY_MALMO,
          planId: normalized.planId,
          planName: normalized.planName,
          planStatus: normalized.planStatus,
          lmAkt: normalized.lmAkt,
          decisionDate: normalized.decisionDate,
          sourceUrl: normalized.sourceUrl,
          municipality: "Malmö",
          municipalityCode: "1280",
        },
        clipWest: bbox.west,
        clipSouth: bbox.south,
        clipEast: bbox.east,
        clipNorth: bbox.north,
        sourceVersion: PLANNING_SOURCE_SLUG,
      });
    }
    if (features.length < PAGE_SIZE && !exceededTransferLimit) break;
    resultOffset += features.length;
    if (features.length === 0) break;
  }

  writeDiskCache(bbox, rows);
  return rows;
}
