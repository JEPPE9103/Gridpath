/**
 * Minimal shapefile polygon + DBF reader for official Swedish ingest.
 * Shared by Ei covering and Naturvårdsverket download fallbacks.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export function findShapefileBase(dir) {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const names = readdirSync(current);
    const shp = names.find((name) => name.toLowerCase().endsWith(".shp"));
    if (shp) {
      const base = shp.slice(0, -4);
      const required = [".shp", ".dbf", ".shx"];
      for (const ext of required) {
        const match = names.find((name) => name.toLowerCase() === `${base}${ext}`.toLowerCase());
        if (!match) {
          throw new Error(`Official shapefile is missing ${ext}: ${base}${ext}`);
        }
      }
      const dbf = names.find((name) => name.toLowerCase() === `${base}.dbf`.toLowerCase());
      const shx = names.find((name) => name.toLowerCase() === `${base}.shx`.toLowerCase());
      const prj = names.find((name) => name.toLowerCase() === `${base}.prj`.toLowerCase());
      return {
        baseName: base,
        shpPath: path.join(current, shp),
        dbfPath: path.join(current, dbf),
        shxPath: path.join(current, shx),
        prjPath: prj ? path.join(current, prj) : null,
      };
    }
    for (const name of names) {
      const child = path.join(current, name);
      if (statSync(child).isDirectory()) stack.push(child);
    }
  }
  throw new Error("Official ZIP did not contain a .shp file.");
}

export function parseDbf(buffer) {
  const recordCount = buffer.readUInt32LE(4);
  const headerLen = buffer.readUInt16LE(8);
  const recordLen = buffer.readUInt16LE(10);
  const fields = [];
  let offset = 32;
  while (offset < headerLen - 1 && buffer[offset] !== 0x0d) {
    const rawName = buffer.slice(offset, offset + 11);
    const name = rawName.toString("utf8").replace(/\0+$/g, "").trim();
    const type = String.fromCharCode(buffer[offset + 11]);
    const length = buffer[offset + 16];
    fields.push({ name, type, length });
    offset += 32;
  }

  const records = [];
  for (let i = 0; i < recordCount; i += 1) {
    const start = headerLen + i * recordLen;
    if (start + recordLen > buffer.length) break;
    const deleted = buffer[start] === 0x2a;
    let cursor = start + 1;
    const row = {};
    for (const field of fields) {
      row[field.name] = buffer.slice(cursor, cursor + field.length).toString("latin1").trim();
      cursor += field.length;
    }
    records.push({ deleted, values: row });
  }
  return { fields, records, recordCount };
}

function ringToWkt(points) {
  if (points.length === 0) return null;
  const closed = [...points];
  const first = closed[0];
  const last = closed[closed.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) closed.push(first);
  if (closed.length < 4) return null;
  return `(${closed.map(([x, y]) => `${x} ${y}`).join(",")})`;
}

function polygonRecordToWkt(buffer, start) {
  if (start + 4 > buffer.length) return { wkt: null, reason: "truncated_record" };
  const type = buffer.readInt32LE(start);
  if (type === 0) return { wkt: null, reason: "null_shape" };
  if (type !== 5 && type !== 15 && type !== 25) {
    return { wkt: null, reason: `unsupported_shape_type_${type}` };
  }
  if (start + 44 > buffer.length) return { wkt: null, envelope: null, reason: "truncated_polygon_header" };
  const xmin = buffer.readDoubleLE(start + 4);
  const ymin = buffer.readDoubleLE(start + 8);
  const xmax = buffer.readDoubleLE(start + 12);
  const ymax = buffer.readDoubleLE(start + 16);
  const envelope = { xmin, ymin, xmax, ymax };
  const numParts = buffer.readInt32LE(start + 36);
  const numPoints = buffer.readInt32LE(start + 40);
  const partsStart = start + 44;
  const pointsStart = partsStart + numParts * 4;
  const pointStride = 16;
  if (numParts < 1 || numPoints < 4 || pointsStart + numPoints * pointStride > buffer.length) {
    return { wkt: null, envelope, reason: "invalid_polygon_layout" };
  }
  const parts = [];
  for (let i = 0; i < numParts; i += 1) parts.push(buffer.readInt32LE(partsStart + i * 4));
  const looksGeographic = ymax < 100 && xmax < 100;
  const looksProjected = ymax > 1_000_000 || ymin > 1_000_000;
  const points = [];
  for (let i = 0; i < numPoints; i += 1) {
    points.push([
      buffer.readDoubleLE(pointsStart + i * pointStride),
      buffer.readDoubleLE(pointsStart + i * pointStride + 8),
    ]);
  }
  const rings = [];
  const kept = [];
  for (let i = 0; i < parts.length; i += 1) {
    const from = parts[i];
    const to = i + 1 < parts.length ? parts[i + 1] : numPoints;
    const ringPoints = points.slice(from, to).filter(([x, y]) => {
      if (looksGeographic) {
        return x >= 10 && x <= 25 && y >= 54 && y <= 70;
      }
      if (looksProjected) {
        return y >= 1_000_000 && y <= 9_000_000 && x >= -200_000 && x <= 2_000_000;
      }
      return true;
    });
    kept.push(...ringPoints);
    const ring = ringToWkt(ringPoints);
    if (ring) rings.push(ring);
  }
  if (rings.length === 0) return { wkt: null, envelope, reason: "empty_rings" };
  const cleanEnvelope = kept.length
    ? {
        xmin: Math.min(...kept.map((point) => point[0])),
        ymin: Math.min(...kept.map((point) => point[1])),
        xmax: Math.max(...kept.map((point) => point[0])),
        ymax: Math.max(...kept.map((point) => point[1])),
      }
    : envelope;
  return {
    wkt: `MULTIPOLYGON(${rings.map((ring) => `(${ring})`).join(",")})`,
    envelope: cleanEnvelope,
    reason: null,
  };
}

export function readShapefilePolygons(shpBuffer, shxBuffer) {
  const fileCode = shpBuffer.readInt32BE(0);
  if (fileCode !== 9994) throw new Error(`Unexpected shapefile file code ${fileCode}`);
  const geometries = [];
  if (shxBuffer) {
    const recordCount = Math.floor((shxBuffer.length - 100) / 8);
    for (let i = 0; i < recordCount; i += 1) {
      const recordOffset = shxBuffer.readInt32BE(100 + i * 8) * 2;
      const { wkt, envelope } = polygonRecordToWkt(shpBuffer, recordOffset + 8);
      geometries.push({ wkt, envelope });
    }
  }
  return { geometries };
}

export function readShapefileDir(dir) {
  const files = findShapefileBase(dir);
  const shp = readFileSync(files.shpPath);
  const shx = existsSync(files.shxPath) ? readFileSync(files.shxPath) : null;
  const dbf = parseDbf(readFileSync(files.dbfPath));
  const { geometries } = readShapefilePolygons(shp, shx);
  return { files, dbf, geometries };
}
