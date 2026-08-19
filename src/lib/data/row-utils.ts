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

  if (typeof geom === "object" && geom !== null && "coordinates" in geom) {
    const coordinates = (geom as { coordinates?: unknown }).coordinates;
    if (
      Array.isArray(coordinates) &&
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number"
    ) {
      return { longitude: coordinates[0], latitude: coordinates[1] };
    }
  }

  if (typeof geom === "string") {
    const match = geom.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      return { longitude: Number(match[1]), latitude: Number(match[2]) };
    }
  }

  return null;
}
