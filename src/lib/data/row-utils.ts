export function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function toNumber(value: number | string | null | undefined): number {
  if (value == null || value === "") {
    return 0;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parsePoint(geom: unknown): { latitude: number; longitude: number } | null {
  if (!geom) {
    return null;
  }

  if (typeof geom === "object" && geom !== null) {
    if ("geometry" in geom && !("coordinates" in geom)) {
      return parsePoint((geom as { geometry: unknown }).geometry);
    }
    if ("coordinates" in geom) {
      const coordinates = (geom as { coordinates?: unknown }).coordinates;
      if (
        Array.isArray(coordinates) &&
        typeof coordinates[0] === "number" &&
        typeof coordinates[1] === "number"
      ) {
        return { longitude: coordinates[0], latitude: coordinates[1] };
      }
    }
  }

  if (typeof geom === "string") {
    const match = geom.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      return { longitude: Number(match[1]), latitude: Number(match[2]) };
    }
    return parseEwkbPoint(geom);
  }

  return null;
}

function parseEwkbPoint(value: string): { latitude: number; longitude: number } | null {
  const hex = value.replace(/^\\x/i, "").trim();
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length < 42) {
    return null;
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  const view = new DataView(bytes.buffer);
  const littleEndian = bytes[0] === 1;
  if (!littleEndian) {
    return null;
  }

  const type = view.getUint32(1, true);
  const geomType = type & 0xff;
  if (geomType !== 1) {
    return null;
  }

  let offset = 5;
  if ((type & 0x20000000) !== 0) {
    offset += 4;
  }
  if (bytes.length < offset + 16) {
    return null;
  }

  const longitude = view.getFloat64(offset, true);
  const latitude = view.getFloat64(offset + 8, true);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}
