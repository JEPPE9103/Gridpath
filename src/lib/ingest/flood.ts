import { createHash } from "node:crypto";
import { fromArrayBuffer } from "geotiff";
import { FLOOD_SOURCE_SLUG } from "@/lib/ingest/coverage-keys";
import { fetchOpenGeodataBytes, fetchOpenGeodataText } from "@/lib/ingest/open-geodata";
import type { SearchBbox } from "@/lib/opportunities/spatial-screening";

/** MCF/MSB INSPIRE — official Swedish flood extent mapping (översvämningskartering). */
export const MSB_FLOOD_WFS = "https://inspire.mcf.se/geoserver/oversvamning/wfs";
export const MSB_FLOOD_WMS = "https://inspire.mcf.se/geoserver/oversvamning/wms";

/**
 * Screening uses BHF (beräknat högsta flöde / calculated highest flow).
 * This is the most extensive official mapped inundation class published in the
 * service — a screening assumption, not an engineering design standard.
 */
export const MSB_FLOOD_TYPE_NAME = "oversvamning:NZ_Oversvamning_BHF";
export const MSB_FLOOD_WMS_LAYER = "NZ_Oversvamning_BHF";
export const MSB_FLOOD_CLASS = "bhf";
export const MSB_FLOOD_CLASS_LABEL = "Calculated highest flow (BHF)";

const PAGE_SIZE = 5;
const MAX_PAGES = 20;
const FETCH_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 2;
const WMS_WIDTH = 200;
const WMS_HEIGHT = 160;
const WMS_BLOCK = 4;

export type FloodFeatureRow = {
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

export function buildFloodWfsUrl(bbox: SearchBbox, startIndex = 0, count = PAGE_SIZE): string {
  const url = new URL(MSB_FLOOD_WFS);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("typeNames", MSB_FLOOD_TYPE_NAME);
  url.searchParams.set("outputFormat", "application/json");
  url.searchParams.set("srsName", "EPSG:4326");
  url.searchParams.set("count", String(count));
  url.searchParams.set("startIndex", String(startIndex));
  url.searchParams.set("bbox", `${bbox.west},${bbox.south},${bbox.east},${bbox.north},EPSG:4326`);
  return url.href;
}

export function buildFloodWmsUrl(bbox: SearchBbox, width = WMS_WIDTH, height = WMS_HEIGHT): string {
  // WMS 1.3.0 + EPSG:4326 uses lat,lon axis order.
  const url = new URL(MSB_FLOOD_WMS);
  url.searchParams.set("service", "WMS");
  url.searchParams.set("version", "1.3.0");
  url.searchParams.set("request", "GetMap");
  url.searchParams.set("layers", MSB_FLOOD_WMS_LAYER);
  url.searchParams.set("styles", "");
  url.searchParams.set("crs", "EPSG:4326");
  url.searchParams.set("bbox", `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`);
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));
  url.searchParams.set("format", "image/geotiff");
  url.searchParams.set("transparent", "true");
  return url.href;
}

function parseFeatures(
  text: string,
): Array<{ id?: string; properties?: Record<string, unknown>; geometry?: Record<string, unknown> }> {
  if (text.includes("ExceptionReport") || text.includes("ows:Exception")) {
    throw new Error(`MSB flood WFS ExceptionReport: ${text.slice(0, 240)}`);
  }
  const parsed = JSON.parse(text) as { features?: unknown };
  return Array.isArray(parsed.features) ? (parsed.features as never) : [];
}

function asMultiPolygon(geom: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!geom || typeof geom.type !== "string") return null;
  if (geom.type === "Polygon" || geom.type === "MultiPolygon") return geom;
  return null;
}

function featureExternalId(
  feature: { id?: string; properties?: Record<string, unknown> },
  bbox: SearchBbox,
): string {
  const props = feature.properties ?? {};
  const objectId = props.objectid ?? props.OBJECTID ?? props.id;
  const base =
    objectId != null && String(objectId).trim()
      ? String(objectId).trim()
      : feature.id && String(feature.id).trim()
        ? String(feature.id).trim()
        : createHash("sha1").update(JSON.stringify(props)).digest("hex").slice(0, 16);
  return `bhf:${base}:${bbox.west.toFixed(4)}:${bbox.south.toFixed(4)}`;
}

export function floodSnapshotHash(bbox: SearchBbox, featureCount: number, mode: string): string {
  return createHash("sha256")
    .update(JSON.stringify({ source: FLOOD_SOURCE_SLUG, layer: MSB_FLOOD_TYPE_NAME, bbox, featureCount, mode }))
    .digest("hex");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFloodPage(bbox: SearchBbox, startIndex: number): Promise<ReturnType<typeof parseFeatures>> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const text = await fetchOpenGeodataText(buildFloodWfsUrl(bbox, startIndex, PAGE_SIZE), FETCH_TIMEOUT_MS);
      return parseFeatures(text);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await sleep(600 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function floodHits(bbox: SearchBbox): Promise<number> {
  const url = new URL(MSB_FLOOD_WFS);
  url.searchParams.set("service", "WFS");
  url.searchParams.set("version", "2.0.0");
  url.searchParams.set("request", "GetFeature");
  url.searchParams.set("typeNames", MSB_FLOOD_TYPE_NAME);
  url.searchParams.set("resultType", "hits");
  url.searchParams.set("bbox", `${bbox.west},${bbox.south},${bbox.east},${bbox.north},EPSG:4326`);
  const text = await fetchOpenGeodataText(url.href, 30_000);
  const matched = text.match(/numberMatched=["']?(\d+)/i);
  return matched ? Number(matched[1]) : 0;
}

function toRow(
  feature: { id?: string; properties?: Record<string, unknown>; geometry?: Record<string, unknown> },
  bbox: SearchBbox,
): FloodFeatureRow | null {
  const geom = asMultiPolygon(feature.geometry);
  if (!geom) return null;
  const props = feature.properties ?? {};
  return {
    id: featureExternalId(feature, bbox),
    name: MSB_FLOOD_CLASS_LABEL,
    designation: MSB_FLOOD_CLASS,
    geom,
    clipWest: bbox.west,
    clipSouth: bbox.south,
    clipEast: bbox.east,
    clipNorth: bbox.north,
    properties: {
      likelihood: props.likelihoodofoccurence ?? props.likelihoodOfOccurrence ?? null,
      typeOfHazard: props.typeofhazard ?? props.typeOfHazard ?? "flood",
      determinationMethod: props.determinationmethod ?? props.determinationMethod ?? null,
      beginLifespanVersion: props.beginlifespanversion ?? null,
      layer: MSB_FLOOD_TYPE_NAME,
      screeningClass: MSB_FLOOD_CLASS,
      ingestMode: "wfs_vector",
    },
  };
}

function isFloodPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 32) return false;
  // Near-white / empty canvas is not flood.
  if (r > 245 && g > 245 && b > 245) return false;
  return true;
}

/**
 * Official WMS window mask when vector GeoJSON payloads are too large to download.
 * Builds coarse cell polygons inside the Search Area window only — never national raw WMS to the browser.
 */
export async function fetchFloodFeaturesFromWmsMask(bbox: SearchBbox): Promise<FloodFeatureRow[]> {
  const bytes = await fetchOpenGeodataBytes(buildFloodWmsUrl(bbox), 90_000);
  const head = new TextDecoder().decode(bytes.slice(0, 80));
  if (head.includes("ServiceException") || head.includes("ExceptionReport")) {
    throw new Error(`MSB flood WMS ExceptionReport: ${head.slice(0, 200)}`);
  }
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const tiff = await fromArrayBuffer(copy);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const rasters = await image.readRasters();
  const rBand = rasters[0] as ArrayLike<number>;
  const gBand = (rasters[1] as ArrayLike<number> | undefined) ?? rBand;
  const bBand = (rasters[2] as ArrayLike<number> | undefined) ?? rBand;
  const aBand = (rasters[3] as ArrayLike<number> | undefined) ?? null;

  const lonStep = (bbox.east - bbox.west) / width;
  const latStep = (bbox.north - bbox.south) / height;
  const rows: FloodFeatureRow[] = [];

  for (let y = 0; y < height; y += WMS_BLOCK) {
    for (let x = 0; x < width; x += WMS_BLOCK) {
      let hit = false;
      for (let dy = 0; dy < WMS_BLOCK && y + dy < height && !hit; dy += 1) {
        for (let dx = 0; dx < WMS_BLOCK && x + dx < width; dx += 1) {
          const idx = (y + dy) * width + (x + dx);
          const a = aBand ? Number(aBand[idx] ?? 255) : 255;
          if (isFloodPixel(Number(rBand[idx] ?? 0), Number(gBand[idx] ?? 0), Number(bBand[idx] ?? 0), a)) {
            hit = true;
            break;
          }
        }
      }
      if (!hit) continue;
      const west = bbox.west + x * lonStep;
      const east = bbox.west + Math.min(width, x + WMS_BLOCK) * lonStep;
      // GeoTIFF rows are north→south for this WMS.
      const north = bbox.north - y * latStep;
      const south = bbox.north - Math.min(height, y + WMS_BLOCK) * latStep;
      rows.push({
        id: `bhf:wms:${bbox.west.toFixed(4)}:${bbox.south.toFixed(4)}:${x}:${y}`,
        name: MSB_FLOOD_CLASS_LABEL,
        designation: MSB_FLOOD_CLASS,
        geom: {
          type: "Polygon",
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
        clipWest: bbox.west,
        clipSouth: bbox.south,
        clipEast: bbox.east,
        clipNorth: bbox.north,
        properties: {
          layer: MSB_FLOOD_WMS_LAYER,
          screeningClass: MSB_FLOOD_CLASS,
          ingestMode: "wms_window_mask",
          note: "Coarse official WMS window mask used because the published vector payload was too large for on-demand download.",
        },
      });
    }
  }
  return rows;
}

async function fetchFloodFeaturesFromWfs(bbox: SearchBbox): Promise<FloodFeatureRow[]> {
  const byId = new Map<string, FloodFeatureRow>();
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const features = await fetchFloodPage(bbox, page * PAGE_SIZE);
    if (features.length === 0) break;
    for (const feature of features) {
      const row = toRow(feature, bbox);
      if (row) byId.set(row.id, row);
    }
    if (features.length < PAGE_SIZE) break;
  }
  return [...byId.values()];
}

/**
 * Fetch official mapped flood geography for a Search Area bbox.
 * Prefers WFS vectors; falls back to official WMS window masks when vector payloads fail.
 * Empty result is valid: the window was evaluated and no polygons intersect.
 */
export async function fetchFloodFeatures(bbox: SearchBbox): Promise<FloodFeatureRow[]> {
  try {
    return await fetchFloodFeaturesFromWfs(bbox);
  } catch (vectorError) {
    const hits = await floodHits(bbox).catch(() => 0);
    if (hits <= 0) {
      // No mapped flood in the official dataset for this window.
      return [];
    }
    try {
      return await fetchFloodFeaturesFromWmsMask(bbox);
    } catch (wmsError) {
      const vectorMessage = vectorError instanceof Error ? vectorError.message : String(vectorError);
      const wmsMessage = wmsError instanceof Error ? wmsError.message : String(wmsError);
      throw new Error(`MSB flood vector failed (${vectorMessage}); WMS mask failed (${wmsMessage})`);
    }
  }
}
