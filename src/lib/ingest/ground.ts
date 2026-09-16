import { createHash } from "node:crypto";
import { GROUND_SOURCE_SLUG } from "@/lib/ingest/coverage-keys";
import { fetchOpenGeodataText } from "@/lib/ingest/open-geodata";
import {
  GROUND_NORMALIZE_VERSION,
  normalizeSguGroundClass,
  type GroundGroup,
} from "@/lib/opportunities/ground";
import type { SearchBbox } from "@/lib/opportunities/spatial-screening";

/** SGU open data — Jordarter 1:25 000–1:100 000 via OGC API Features. */
export const SGU_JORDARTER_OGC_BASE =
  "https://api.sgu.se/oppnadata/jordarter25k-100k/ogc/features/v1";
export const SGU_JORDARTER_COLLECTION = "grundlager";

const PAGE_SIZE = 500;
const MAX_PAGES = 40;
const FETCH_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 2;

export type GroundFeatureRow = {
  id: string;
  name: string;
  designation: string;
  geom: Record<string, unknown>;
  properties: Record<string, unknown>;
  clipWest?: number;
  clipSouth?: number;
  clipEast?: number;
  clipNorth?: number;
};

export function buildSguGroundItemsUrl(bbox: SearchBbox, startIndex = 0, limit = PAGE_SIZE): string {
  const url = new URL(`${SGU_JORDARTER_OGC_BASE}/collections/${SGU_JORDARTER_COLLECTION}/items`);
  url.searchParams.set("f", "json");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("startIndex", String(startIndex));
  // OGC API Features bbox: minLon,minLat,maxLon,maxLat (CRS84)
  url.searchParams.set("bbox", `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`);
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

type OgcFeature = {
  id?: string;
  properties?: Record<string, unknown>;
  geometry?: Record<string, unknown>;
};

function parseFeatureCollection(text: string): { features: OgcFeature[]; numberMatched?: number } {
  const parsed = JSON.parse(text) as {
    features?: unknown;
    numberMatched?: number;
    totalFeatures?: number;
  };
  const features = Array.isArray(parsed.features) ? (parsed.features as OgcFeature[]) : [];
  const numberMatched =
    typeof parsed.numberMatched === "number"
      ? parsed.numberMatched
      : typeof parsed.totalFeatures === "number"
        ? parsed.totalFeatures
        : undefined;
  return { features, numberMatched };
}

async function fetchGroundPage(bbox: SearchBbox, startIndex: number): Promise<ReturnType<typeof parseFeatureCollection>> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const text = await fetchOpenGeodataText(buildSguGroundItemsUrl(bbox, startIndex, PAGE_SIZE), FETCH_TIMEOUT_MS);
      return parseFeatureCollection(text);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await sleep(400 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("SGU ground fetch failed");
}

function featureExternalId(feature: OgcFeature, bbox: SearchBbox, group: GroundGroup): string {
  const props = feature.properties ?? {};
  const objectId = props.objectid ?? props.OBJECTID ?? feature.id;
  const base =
    objectId != null && String(objectId).trim()
      ? String(objectId).trim()
      : createHash("sha1").update(JSON.stringify(props)).digest("hex").slice(0, 16);
  return `sgu:${group}:${base}:${bbox.west.toFixed(4)}:${bbox.south.toFixed(4)}`;
}

export function groundSnapshotHash(bbox: SearchBbox, featureCount: number): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        source: GROUND_SOURCE_SLUG,
        collection: SGU_JORDARTER_COLLECTION,
        normalize: GROUND_NORMALIZE_VERSION,
        bbox,
        featureCount,
      }),
    )
    .digest("hex");
}

export async function fetchGroundFeatures(bbox: SearchBbox): Promise<GroundFeatureRow[]> {
  const rows: GroundFeatureRow[] = [];
  let startIndex = 0;
  let matched: number | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { features, numberMatched } = await fetchGroundPage(bbox, startIndex);
    if (typeof numberMatched === "number") matched = numberMatched;
    if (features.length === 0) break;

    for (const feature of features) {
      const geom = asMultiPolygon(feature.geometry);
      if (!geom) continue;
      const props = feature.properties ?? {};
      const jg2 = props.jg2;
      const jg2Tx = props.jg2_tx != null ? String(props.jg2_tx) : "";
      const group = normalizeSguGroundClass(
        typeof jg2 === "number" || typeof jg2 === "string" ? jg2 : null,
        jg2Tx,
      );
      rows.push({
        id: featureExternalId(feature, bbox, group),
        name: jg2Tx || `jg2:${String(jg2 ?? "unknown")}`,
        designation: group,
        geom,
        properties: {
          ...props,
          jg2,
          jg2_tx: jg2Tx,
          normalized_group: group,
          normalize_version: GROUND_NORMALIZE_VERSION,
          map_scale: "1:25 000–1:100 000",
        },
        clipWest: bbox.west,
        clipSouth: bbox.south,
        clipEast: bbox.east,
        clipNorth: bbox.north,
      });
    }

    startIndex += features.length;
    if (features.length < PAGE_SIZE) break;
    if (typeof matched === "number" && startIndex >= matched) break;
  }

  return rows;
}
