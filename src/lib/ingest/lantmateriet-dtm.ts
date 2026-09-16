import { createHash } from "node:crypto";
import { fromArrayBuffer } from "geotiff";
import { DTM_SOURCE_SLUG } from "@/lib/ingest/coverage-keys";
import {
  DETAILED_TERRAIN_SUMMARY_RESOLUTION_M,
  DETAILED_TERRAIN_PROVIDER_KEY,
} from "@/lib/opportunities/detailed-terrain";
import {
  lantmaterietCredentialsConfigured,
  LANTMATERIET_STAC_URL,
} from "@/lib/opportunities/lantmateriet";
import { hornSlopeDegrees, percentile } from "@/lib/opportunities/terrain";
import type { SearchBbox } from "@/lib/opportunities/spatial-screening";

const FETCH_TIMEOUT_MS = 120_000;
const MAX_TILES_PER_WINDOW = 4;
const MAX_BYTES_PER_TILE = 80_000_000;
const SAMPLE_STRIDE = 8;
const BIN_DEG = 0.001; // ~100 m at Swedish latitudes

export type DetailedTerrainSummaryRow = {
  externalId: string;
  west: number;
  south: number;
  east: number;
  north: number;
  resolutionM: number;
  meanSlopeDeg: number;
  medianSlopeDeg: number;
  p90SlopeDeg: number;
  maxSlopeDeg: number;
  pctLe5: number;
  pctLe8: number;
  pctLe12: number;
  elevMinM: number;
  elevMaxM: number;
  elevRangeM: number;
};

export type DtmAuthHeaders = { authorization: string };

export function dtmAuthHeaders(env: NodeJS.ProcessEnv = process.env): DtmAuthHeaders | null {
  const token = env.LANTMATERIET_STAC_TOKEN?.trim();
  const user = env.LANTMATERIET_GEOTORGET_USERNAME?.trim();
  const password = env.LANTMATERIET_GEOTORGET_PASSWORD?.trim();
  if (token) return { authorization: `Bearer ${token}` };
  if (user && password) {
    return { authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}` };
  }
  return null;
}

export function dtmConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return lantmaterietCredentialsConfigured(env);
}

export function buildDtmStacSearchUrl(bbox: SearchBbox, limit = 20): string {
  const url = new URL(`${LANTMATERIET_STAC_URL}/search`);
  url.searchParams.set("bbox", `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`);
  url.searchParams.set("limit", String(limit));
  return url.href;
}

export function dtmSnapshotHash(bbox: SearchBbox, tileCount: number, summaryCount: number): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        source: DTM_SOURCE_SLUG,
        provider: DETAILED_TERRAIN_PROVIDER_KEY,
        bbox,
        tileCount,
        summaryCount,
        summaryResolutionM: DETAILED_TERRAIN_SUMMARY_RESOLUTION_M,
      }),
    )
    .digest("hex");
}

type StacAsset = { href?: string; type?: string; roles?: string[] };
type StacFeature = {
  id?: string;
  assets?: Record<string, StacAsset>;
  geometry?: unknown;
  bbox?: number[];
};

function pickDownloadHref(feature: StacFeature): string | null {
  const assets = feature.assets ?? {};
  const preferredKeys = ["data", "elevation", "dtm", "dem", "tiff", "geotiff", "asset"];
  for (const key of preferredKeys) {
    const href = assets[key]?.href;
    if (href) return href;
  }
  for (const asset of Object.values(assets)) {
    const type = (asset.type ?? "").toLowerCase();
    const roles = asset.roles ?? [];
    if (
      asset.href &&
      (type.includes("tiff") || type.includes("geotiff") || roles.includes("data") || roles.includes("elevation"))
    ) {
      return asset.href;
    }
  }
  for (const asset of Object.values(assets)) {
    if (asset.href) return asset.href;
  }
  return null;
}

async function fetchWithAuth(url: string, auth: DtmAuthHeaders, accept: string): Promise<Uint8Array> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        authorization: auth.authorization,
        accept,
        "user-agent": "NOXHEIM/1.0 (+https://www.noxheim.com; lantmateriet-dtm)",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`Lantmäteriet HTTP ${response.status} for ${url.slice(0, 120)}`);
    }
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES_PER_TILE) {
      throw new Error(`Lantmäteriet tile exceeds ${MAX_BYTES_PER_TILE} byte guardrail`);
    }
    return buffer;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchDtmTiles(bbox: SearchBbox, auth: DtmAuthHeaders): Promise<StacFeature[]> {
  const text = new TextDecoder().decode(
    await fetchWithAuth(buildDtmStacSearchUrl(bbox, MAX_TILES_PER_WINDOW), auth, "application/geo+json, application/json"),
  );
  const parsed = JSON.parse(text) as { features?: StacFeature[] };
  return Array.isArray(parsed.features) ? parsed.features.slice(0, MAX_TILES_PER_WINDOW) : [];
}

function hornSlopeDeg(
  z: ArrayLike<number>,
  width: number,
  x: number,
  y: number,
  dx: number,
  dy: number,
): number {
  const at = (col: number, row: number) => Number(z[row * width + col]);
  const dzdx =
    (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1))) /
    (8 * dx);
  const dzdy =
    (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1))) /
    (8 * dy);
  return hornSlopeDegrees(dzdx, dzdy);
}

type BinAccum = { slopes: number[]; elevs: number[] };

export async function terrainSummariesFromDtmBytes(
  bytes: Uint8Array,
  bbox: SearchBbox,
  tileId: string,
): Promise<DetailedTerrainSummaryRow[]> {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const tiff = await fromArrayBuffer(copy);
  const image = await tiff.getImage();
  const rasters = await image.readRasters();
  const z = rasters[0] as ArrayLike<number>;
  const width = image.getWidth();
  const height = image.getHeight();
  const [originX, originY] = image.getOrigin();
  const [resX, resY] = image.getResolution();
  const bins = new Map<string, BinAccum>();

  for (let y = 1; y < height - 1; y += SAMPLE_STRIDE) {
    for (let x = 1; x < width - 1; x += SAMPLE_STRIDE) {
      const lon = originX + x * resX;
      const lat = originY + y * resY;
      if (lon < bbox.west || lon > bbox.east || lat < bbox.south || lat > bbox.north) continue;
      const elev = Number(z[y * width + x]);
      if (!Number.isFinite(elev) || elev < -100 || elev > 3000) continue;
      const metersPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
      const slope = hornSlopeDeg(z, width, x, y, Math.abs(resX) * metersPerDegLon, Math.abs(resY) * 110540);
      if (!Number.isFinite(slope)) continue;
      const south = Math.floor(lat / BIN_DEG) * BIN_DEG;
      const west = Math.floor(lon / BIN_DEG) * BIN_DEG;
      const key = `${south.toFixed(4)}:${west.toFixed(4)}`;
      const bin = bins.get(key) ?? { slopes: [], elevs: [] };
      bin.slopes.push(slope);
      bin.elevs.push(elev);
      bins.set(key, bin);
    }
  }

  const rows: DetailedTerrainSummaryRow[] = [];
  for (const [key, accum] of bins) {
    if (accum.slopes.length < 3) continue;
    const sorted = accum.slopes.slice().sort((a, b) => a - b);
    const [southStr, westStr] = key.split(":");
    const south = Number(southStr);
    const west = Number(westStr);
    const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
    const elevMin = Math.min(...accum.elevs);
    const elevMax = Math.max(...accum.elevs);
    rows.push({
      externalId: `dtm1m:${tileId}:${key}`,
      west,
      south,
      east: west + BIN_DEG,
      north: south + BIN_DEG,
      resolutionM: DETAILED_TERRAIN_SUMMARY_RESOLUTION_M,
      meanSlopeDeg: mean,
      medianSlopeDeg: percentile(sorted, 0.5) ?? mean,
      p90SlopeDeg: percentile(sorted, 0.9) ?? mean,
      maxSlopeDeg: sorted[sorted.length - 1] ?? mean,
      pctLe5: (sorted.filter((v) => v <= 5).length / sorted.length) * 100,
      pctLe8: (sorted.filter((v) => v <= 8).length / sorted.length) * 100,
      pctLe12: (sorted.filter((v) => v <= 12).length / sorted.length) * 100,
      elevMinM: elevMin,
      elevMaxM: elevMax,
      elevRangeM: elevMax - elevMin,
    });
  }
  return rows;
}

export async function fetchDetailedTerrainSummaries(
  bbox: SearchBbox,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ rows: DetailedTerrainSummaryRow[]; tileCount: number; authRequired: boolean }> {
  const auth = dtmAuthHeaders(env);
  if (!auth) {
    return { rows: [], tileCount: 0, authRequired: true };
  }
  const features = await searchDtmTiles(bbox, auth);
  const rows: DetailedTerrainSummaryRow[] = [];
  for (const feature of features) {
    const href = pickDownloadHref(feature);
    if (!href) continue;
    const bytes = await fetchWithAuth(href, auth, "image/tiff, application/octet-stream, */*");
    const tileId =
      feature.id && String(feature.id).trim()
        ? String(feature.id).trim().slice(0, 64)
        : createHash("sha1").update(href).digest("hex").slice(0, 12);
    const summaries = await terrainSummariesFromDtmBytes(bytes, bbox, tileId);
    rows.push(...summaries);
  }
  return { rows, tileCount: features.length, authRequired: false };
}
