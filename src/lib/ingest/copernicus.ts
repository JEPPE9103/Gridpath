import { createHash } from "node:crypto";
import { fromArrayBuffer } from "geotiff";
import { COPERNICUS_SOURCE_SLUG } from "@/lib/ingest/coverage-keys";
import { fetchOpenGeodataBytes } from "@/lib/ingest/open-geodata";
import type { SearchBbox } from "@/lib/opportunities/spatial-screening";

export const COPERNICUS_TILE_HOST = "https://copernicus-dem-90m.s3.amazonaws.com";

export type TerrainSummaryRow = {
  externalId: string;
  west: number;
  south: number;
  east: number;
  north: number;
  meanSlopeDeg: number;
  medianSlopeDeg: number;
  p90SlopeDeg: number;
  maxSlopeDeg: number;
  pctLe5: number;
  pctLe8: number;
  pctLe12: number;
};

function tileFileName(lat: number, lon: number): string {
  const n = String(Math.abs(lat)).padStart(2, "0");
  const e = String(Math.abs(lon)).padStart(3, "0");
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `Copernicus_DSM_COG_30_${ns}${n}_00_${ew}${e}_00_DEM`;
}

export function copernicusCogUrl(lat: number, lon: number): string {
  const name = tileFileName(lat, lon);
  return `${COPERNICUS_TILE_HOST}/${name}/${name}.tif`;
}

function hornSlopeDeg(z: ArrayLike<number>, width: number, x: number, y: number, dx: number, dy: number): number {
  const at = (col: number, row: number) => Number(z[row * width + col]);
  const dzdx =
    (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1))) /
    (8 * dx);
  const dzdy =
    (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1))) /
    (8 * dy);
  return (Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * 180) / Math.PI;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  return (sorted[lower] ?? 0) * (1 - (index - lower)) + (sorted[upper] ?? 0) * (index - lower);
}

export async function terrainSummariesFromDemBytes(bytes: Uint8Array, bbox: SearchBbox): Promise<TerrainSummaryRow[]> {
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
  const bins = new Map<string, number[]>();
  for (let y = 1; y < height - 1; y += 4) {
    for (let x = 1; x < width - 1; x += 4) {
      const lon = originX + x * resX;
      const lat = originY + y * resY;
      if (lon < bbox.west || lon > bbox.east || lat < bbox.south || lat > bbox.north) continue;
      const elev = Number(z[y * width + x]);
      if (!Number.isFinite(elev) || elev < -100) continue;
      const metersPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
      const slope = hornSlopeDeg(z, width, x, y, Math.abs(resX) * metersPerDegLon, Math.abs(resY) * 110540);
      if (!Number.isFinite(slope)) continue;
      const key = `${Math.floor(lat * 100) / 100}:${Math.floor(lon * 100) / 100}`;
      const bin = bins.get(key) ?? [];
      bin.push(slope);
      bins.set(key, bin);
    }
  }
  const rows: TerrainSummaryRow[] = [];
  for (const [key, values] of bins) {
    if (values.length < 4) continue;
    const sorted = values.slice().sort((a, b) => a - b);
    const [latStr, lonStr] = key.split(":");
    const south = Number(latStr);
    const west = Number(lonStr);
    const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
    rows.push({
      externalId: `glo90:${key}`,
      west,
      south,
      east: west + 0.01,
      north: south + 0.01,
      meanSlopeDeg: mean,
      medianSlopeDeg: percentile(sorted, 0.5),
      p90SlopeDeg: percentile(sorted, 0.9),
      maxSlopeDeg: sorted[sorted.length - 1] ?? mean,
      pctLe5: (sorted.filter((value) => value <= 5).length / sorted.length) * 100,
      pctLe8: (sorted.filter((value) => value <= 8).length / sorted.length) * 100,
      pctLe12: (sorted.filter((value) => value <= 12).length / sorted.length) * 100,
    });
  }
  return rows;
}

export async function fetchCopernicusTileSummaries(lat: number, lon: number, bbox: SearchBbox): Promise<TerrainSummaryRow[]> {
  const url = copernicusCogUrl(lat, lon);
  const bytes = await fetchOpenGeodataBytes(url);
  return terrainSummariesFromDemBytes(bytes, bbox);
}

export function copernicusSnapshotHash(bbox: SearchBbox, rowCount: number): string {
  return createHash("sha256")
    .update(`${COPERNICUS_SOURCE_SLUG}|${bbox.west}|${bbox.south}|${bbox.east}|${bbox.north}|${rowCount}`)
    .digest("hex");
}
