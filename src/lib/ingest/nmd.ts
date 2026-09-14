import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { fromFile } from "geotiff";
import { NMD_SOURCE_SLUG } from "@/lib/ingest/coverage-keys";
import type { SearchBbox } from "@/lib/opportunities/spatial-screening";

export type NmdSummaryRow = {
  externalId: string;
  west: number;
  south: number;
  east: number;
  north: number;
  crs: "EPSG:3006";
  nmdClass: number;
  landCoverGroup: string;
};

export function nmd2023ClassToGroup(code: number): string {
  if (!Number.isFinite(code)) return "unclassified";
  const value = Math.trunc(code);
  if (value === 61 || value === 62 || value === 6 || value === 60) return "water";
  if (value === 3 || value === 30 || value === 31) return "agriculture";
  if (value === 51 || value === 52 || value === 53 || value === 54 || value === 5 || value === 50) return "developed";
  if (value === 41 || value === 42 || value === 4 || value === 40) return "open";
  if (value === 43) return "forest";
  if (value === 2 || value === 20 || value === 200 || value === 23) return "wetland";
  if (value >= 21 && value <= 28) return "wetland";
  if (value === 11 || value === 12 || value === 110 || value === 120 || value === 118 || value === 128) return "forest";
  if (value >= 111 && value <= 117) return "forest";
  if (value >= 121 && value <= 127) return "forest";
  return "unclassified";
}

export function geodataCacheRoot(): string {
  return process.env.NOXHEIM_GEODATA_CACHE || path.join(os.homedir(), "noxheim-geodata");
}

export function resolveNmd2023Tif(): string {
  const explicit = process.env.NOXHEIM_NMD2023_TIF?.trim() || "";
  if (explicit && existsSync(explicit)) return explicit;
  const cacheRoot = geodataCacheRoot();
  const names = [
    "NMD2023bas_v0_3.tif",
    "NMD2023_basskikt_v0_3.tif",
    "NMD2023bas_v03.tif",
    path.join("NMD2023_basskikt_v0_3", "NMD2023bas_v0_3.tif"),
  ];
  for (const name of names) {
    const candidate = path.join(cacheRoot, name);
    if (existsSync(candidate)) return candidate;
  }
  return "";
}

function pixelWindow(
  originX: number,
  originY: number,
  resX: number,
  resY: number,
  width: number,
  height: number,
  extent: { xmin: number; ymin: number; xmax: number; ymax: number },
) {
  const col0 = Math.floor((extent.xmin - originX) / resX);
  const col1 = Math.ceil((extent.xmax - originX) / resX);
  const row0 = Math.floor((extent.ymax - originY) / resY);
  const row1 = Math.ceil((extent.ymin - originY) / resY);
  const left = Math.max(0, Math.min(width, Math.min(col0, col1)));
  const right = Math.max(0, Math.min(width, Math.max(col0, col1)));
  const top = Math.max(0, Math.min(height, Math.min(row0, row1)));
  const bottom = Math.max(0, Math.min(height, Math.max(row0, row1)));
  return { left, top, right, bottom };
}

function majorityResample(samples: ArrayLike<number>, srcW: number, srcH: number, factor: number) {
  const outW = Math.max(1, Math.floor(srcW / factor));
  const outH = Math.max(1, Math.floor(srcH / factor));
  const out = new Float64Array(outW * outH);
  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const counts = new Map<number, number>();
      let best = 0;
      let bestN = -1;
      for (let dy = 0; dy < factor; dy += 1) {
        const sy = y * factor + dy;
        if (sy >= srcH) continue;
        for (let dx = 0; dx < factor; dx += 1) {
          const sx = x * factor + dx;
          if (sx >= srcW) continue;
          const code = Number(samples[sy * srcW + sx]);
          if (!Number.isFinite(code) || code <= 0) continue;
          const n = (counts.get(code) ?? 0) + 1;
          counts.set(code, n);
          if (n > bestN) {
            bestN = n;
            best = code;
          }
        }
      }
      out[y * outW + x] = best;
    }
  }
  return { samples: out, width: outW, height: outH };
}

export async function nmdDiscoverySummariesFromTif(
  tifPath: string,
  extent3006: { xmin: number; ymin: number; xmax: number; ymax: number },
): Promise<NmdSummaryRow[]> {
  const tiff = await fromFile(tifPath);
  const image = await tiff.getImage();
  const fullWidth = image.getWidth();
  const fullHeight = image.getHeight();
  const [originX, originY] = image.getOrigin();
  const [resX, resY] = image.getResolution();
  const nativeM = Math.abs(resX);
  const window = pixelWindow(originX, originY, resX, resY, fullWidth, fullHeight, extent3006);
  const winW = Math.max(1, window.right - window.left);
  const winH = Math.max(1, window.bottom - window.top);
  const winOriginX = originX + window.left * resX;
  const winOriginY = originY + window.top * resY;
  const discoveryFactor = Math.max(1, Math.round(1000 / nativeM));
  const rasterOpts = { window: [window.left, window.top, window.right, window.bottom], resampleMethod: "nearest" as const };
  let discoverySamples: ArrayLike<number>;
  let discoveryWidth: number;
  let discoveryHeight: number;
  if (winW * winH <= 12_000_000) {
    const nativeRasters = await image.readRasters(rasterOpts);
    const aggregated = majorityResample(nativeRasters[0] as ArrayLike<number>, winW, winH, discoveryFactor);
    discoverySamples = aggregated.samples;
    discoveryWidth = aggregated.width;
    discoveryHeight = aggregated.height;
  } else {
    discoveryWidth = Math.max(1, Math.round(winW / discoveryFactor));
    discoveryHeight = Math.max(1, Math.round(winH / discoveryFactor));
    const discoveryRasters = await image.readRasters({
      ...rasterOpts,
      width: discoveryWidth,
      height: discoveryHeight,
    });
    discoverySamples = discoveryRasters[0] as ArrayLike<number>;
  }
  const cellW = nativeM * discoveryFactor;
  const cellH = Math.abs(resY) * discoveryFactor;
  const rows: NmdSummaryRow[] = [];
  for (let y = 0; y < discoveryHeight; y += 1) {
    for (let x = 0; x < discoveryWidth; x += 1) {
      const code = Number(discoverySamples[y * discoveryWidth + x]);
      if (!Number.isFinite(code) || code <= 0) continue;
      const xmin = winOriginX + x * cellW;
      const ymax = winOriginY - y * cellH;
      rows.push({
        externalId: `nmd2023:${Math.round(xmin)}:${Math.round(ymax)}`,
        west: xmin,
        south: ymax - cellH,
        east: xmin + cellW,
        north: ymax,
        crs: "EPSG:3006",
        nmdClass: Math.trunc(code),
        landCoverGroup: nmd2023ClassToGroup(code),
      });
    }
  }
  return rows;
}

export function nmdSnapshotHash(bbox: SearchBbox, count: number): string {
  return createHash("sha256")
    .update(`${NMD_SOURCE_SLUG}|${bbox.west}|${bbox.south}|${bbox.east}|${bbox.north}|${count}`)
    .digest("hex");
}
