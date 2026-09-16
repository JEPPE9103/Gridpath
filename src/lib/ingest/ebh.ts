/**
 * Länsstyrelserna EBH — Potentiellt förorenade områden (external layer).
 * Official ZIP shapefile (SWEREF99 TM points). Cached by ETag; bbox-filtered only.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { unzipSync } from "fflate";
import { CONTAMINATION_SOURCE_SLUG } from "@/lib/ingest/coverage-keys";
import { fetchOpenGeodataBytes } from "@/lib/ingest/open-geodata";
import {
  CONTAMINATION_NORMALIZE_VERSION,
  CONTAMINATION_PROVIDER_KEY,
  normalizeEbhRecord,
} from "@/lib/opportunities/contamination";
import type { SearchBbox } from "@/lib/opportunities/spatial-screening";

export const EBH_ZIP_URL =
  "https://ext-dokument.lansstyrelsen.se/Gemensamt/Geodata/Datadistribution/SWEREF99TM/EBH_Potentiellt_fororenade_omraden.zip";

const FETCH_TIMEOUT_MS = 180_000;
const SHP_NAME = "EBH_Potentiellt_fororenade_omraden";

export type ContaminationFeatureRow = {
  id: string;
  name: string;
  designation: string;
  geom: Record<string, unknown>;
  properties: Record<string, unknown>;
};

/** Approx inverse Transverse Mercator for EPSG:3006 (SWEREF99 TM). */
export function sweref99tmToWgs84(easting: number, northing: number): { lon: number; lat: number } {
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const k0 = 0.9996;
  const lon0 = (15 * Math.PI) / 180;
  const falseEasting = 500000.0;
  const e2 = f * (2 - f);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const x = easting - falseEasting;
  const y = northing;
  const m = y / k0;
  const mu = m / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sinPhi = Math.sin(phi1);
  const cosPhi = Math.cos(phi1);
  const tanPhi = Math.tan(phi1);
  const n = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const t = tanPhi * tanPhi;
  const c = (e2 / (1 - e2)) * cosPhi * cosPhi;
  const r = (a * (1 - e2)) / Math.pow(1 - e2 * sinPhi * sinPhi, 1.5);
  const d = x / (n * k0);
  const lat =
    phi1 -
    ((n * tanPhi) / r) *
      (d * d / 2 -
        ((5 + 3 * t + 10 * c - 4 * c * c - 9 * (e2 / (1 - e2))) * d ** 4) / 24 +
        ((61 + 90 * t + 298 * c + 45 * t * t - 252 * (e2 / (1 - e2)) - 3 * c * c) * d ** 6) / 720);
  const lon =
    lon0 +
    (d -
      ((1 + 2 * t + c) * d ** 3) / 6 +
      ((5 - 2 * c + 28 * t - 3 * c * c + 8 * (e2 / (1 - e2)) + 24 * t * t) * d ** 5) / 120) /
      cosPhi;
  return { lon: (lon * 180) / Math.PI, lat: (lat * 180) / Math.PI };
}

/** Approx forward for bbox filter in SWEREF meters. */
export function wgs84ToSweref99tm(lon: number, lat: number): { easting: number; northing: number } {
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const k0 = 0.9996;
  const lon0 = (15 * Math.PI) / 180;
  const falseEasting = 500000.0;
  const e2 = f * (2 - f);
  const phi = (lat * Math.PI) / 180;
  const lam = (lon * Math.PI) / 180;
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const n = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const t = tanPhi * tanPhi;
  const c = (e2 / (1 - e2)) * cosPhi * cosPhi;
  const A = (lam - lon0) * cosPhi;
  const m =
    a *
    ((1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256) * phi -
      ((3 * e2) / 8 + (3 * e2 * e2) / 32 + (45 * e2 * e2 * e2) / 1024) * Math.sin(2 * phi) +
      ((15 * e2 * e2) / 256 + (45 * e2 * e2 * e2) / 1024) * Math.sin(4 * phi) -
      ((35 * e2 * e2 * e2) / 3072) * Math.sin(6 * phi));
  const easting =
    falseEasting +
    k0 *
      n *
      (A +
        ((1 - t + c) * A ** 3) / 6 +
        ((5 - 18 * t + t * t + 72 * c - 58 * (e2 / (1 - e2))) * A ** 5) / 120);
  const northing =
    k0 *
    (m +
      n *
        tanPhi *
        (A * A / 2 +
          ((5 - t + 9 * c + 4 * c * c) * A ** 4) / 24 +
          ((61 - 58 * t + t * t + 600 * c - 330 * (e2 / (1 - e2))) * A ** 6) / 720));
  return { easting, northing };
}

function cacheDir(): string {
  const root = process.env.NOXHEIM_GEODATA_CACHE?.trim() || path.join(tmpdir(), "noxheim-geodata");
  mkdirSync(root, { recursive: true });
  return root;
}

async function loadCachedZip(): Promise<{ bytes: Uint8Array; etag: string | null }> {
  const dir = cacheDir();
  const zipPath = path.join(dir, "ebh-potentiellt-fororenade.zip");
  const metaPath = path.join(dir, "ebh-potentiellt-fororenade.etag");
  const cachedEtag = existsSync(metaPath) ? readFileSync(metaPath, "utf8").trim() : null;
  if (existsSync(zipPath) && cachedEtag) {
    return { bytes: new Uint8Array(readFileSync(zipPath)), etag: cachedEtag };
  }
  const bytes = await fetchOpenGeodataBytes(EBH_ZIP_URL, FETCH_TIMEOUT_MS);
  writeFileSync(zipPath, bytes);
  const etag = createHash("sha256").update(bytes).digest("hex").slice(0, 24);
  writeFileSync(metaPath, etag);
  return { bytes, etag };
}

function parseDbf(buffer: Buffer): { fields: Array<{ name: string; length: number }>; records: Record<string, string>[] } {
  const recordCount = buffer.readUInt32LE(4);
  const headerLen = buffer.readUInt16LE(8);
  const recordLen = buffer.readUInt16LE(10);
  const fields: Array<{ name: string; length: number }> = [];
  let offset = 32;
  while (offset < headerLen - 1 && buffer[offset] !== 0x0d) {
    const name = buffer.slice(offset, offset + 11).toString("utf8").replace(/\0+$/g, "").trim();
    const length = buffer[offset + 16] ?? 0;
    fields.push({ name, length });
    offset += 32;
  }
  const records: Record<string, string>[] = [];
  for (let i = 0; i < recordCount; i += 1) {
    const start = headerLen + i * recordLen;
    if (start + recordLen > buffer.length) break;
    if (buffer[start] === 0x2a) {
      records.push({});
      continue;
    }
    let cursor = start + 1;
    const row: Record<string, string> = {};
    for (const field of fields) {
      // EBH external shapefile DBF strings are UTF-8 (Swedish diacritics).
      row[field.name] = buffer.slice(cursor, cursor + field.length).toString("utf8").replace(/\0/g, "").trim();
      cursor += field.length;
    }
    records.push(row);
  }
  return { fields, records };
}

function readPointGeometries(shp: Buffer, shx: Buffer): Array<{ x: number; y: number } | null> {
  const fileCode = shp.readInt32BE(0);
  if (fileCode !== 9994) throw new Error(`Unexpected shapefile file code ${fileCode}`);
  const shapeType = shp.readInt32LE(32);
  if (shapeType !== 1) throw new Error(`EBH shapefile expected Point (1), got ${shapeType}`);
  const recordCount = Math.floor((shx.length - 100) / 8);
  const points: Array<{ x: number; y: number } | null> = [];
  for (let i = 0; i < recordCount; i += 1) {
    const recordOffset = shx.readInt32BE(100 + i * 8) * 2;
    const type = shp.readInt32LE(recordOffset + 8);
    if (type === 0) {
      points.push(null);
      continue;
    }
    if (type !== 1) {
      points.push(null);
      continue;
    }
    const x = shp.readDoubleLE(recordOffset + 12);
    const y = shp.readDoubleLE(recordOffset + 20);
    points.push({ x, y });
  }
  return points;
}

export function contaminationSnapshotHash(bbox: SearchBbox, featureCount: number, etag: string | null): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        source: CONTAMINATION_SOURCE_SLUG,
        provider: CONTAMINATION_PROVIDER_KEY,
        normalize: CONTAMINATION_NORMALIZE_VERSION,
        bbox,
        featureCount,
        etag,
      }),
    )
    .digest("hex");
}

export async function fetchContaminationFeatures(bbox: SearchBbox): Promise<ContaminationFeatureRow[]> {
  const { bytes, etag } = await loadCachedZip();
  const files = unzipSync(bytes);
  const shp = Buffer.from(files[`${SHP_NAME}.shp`] ?? []);
  const shx = Buffer.from(files[`${SHP_NAME}.shx`] ?? []);
  const dbf = Buffer.from(files[`${SHP_NAME}.dbf`] ?? []);
  if (shp.length < 100 || shx.length < 100 || dbf.length < 32) {
    throw new Error("EBH ZIP missing shapefile components");
  }
  const swMin = wgs84ToSweref99tm(bbox.west, bbox.south);
  const swMax = wgs84ToSweref99tm(bbox.east, bbox.north);
  const minE = Math.min(swMin.easting, swMax.easting) - 50;
  const maxE = Math.max(swMin.easting, swMax.easting) + 50;
  const minN = Math.min(swMin.northing, swMax.northing) - 50;
  const maxN = Math.max(swMin.northing, swMax.northing) + 50;

  const points = readPointGeometries(shp, shx);
  const { records } = parseDbf(dbf);
  const rows: ContaminationFeatureRow[] = [];
  const limit = Math.min(points.length, records.length);
  for (let i = 0; i < limit; i += 1) {
    const point = points[i];
    const props = records[i] ?? {};
    if (!point) continue;
    if (point.x < minE || point.x > maxE || point.y < minN || point.y > maxN) continue;
    const { lon, lat } = sweref99tmToWgs84(point.x, point.y);
    if (lon < bbox.west || lon > bbox.east || lat < bbox.south || lat > bbox.north) continue;
    const normalized = normalizeEbhRecord(props);
    if (!normalized.ebhId || normalized.ebhId === "unknown") continue;
    rows.push({
      id: `ebh:${normalized.ebhId}`,
      name: normalized.primaryBranch ?? `EBH ${normalized.ebhId}`,
      designation: normalized.riskClass ?? "unspecified",
      geom: { type: "Point", coordinates: [lon, lat] },
      properties: {
        ...props,
        normalizeVersion: CONTAMINATION_NORMALIZE_VERSION,
        providerKey: CONTAMINATION_PROVIDER_KEY,
        sourceEtag: etag,
        ebhId: normalized.ebhId,
        status: normalized.status,
        riskClass: normalized.riskClass,
        primaryBranch: normalized.primaryBranch,
        secondaryBranch: normalized.secondaryBranch,
        municipality: normalized.municipality,
        county: normalized.county,
        preciseStatus: normalized.preciseStatus,
      },
    });
  }
  return rows;
}
