/**
 * HTTPS client for allowlisted Swedish / Copernicus open geodata hosts.
 * Separate from the Ei client: do not mix host allowlists.
 */
import dns from "node:dns";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // ignore
}

export const OPEN_GEODATA_USER_AGENT =
  "NOXHEIM/1.0 (+https://www.noxheim.com; official-source-ingest; open-geodata)";

const DEFAULT_TIMEOUT_MS = 60_000;

const ALLOWED_HOSTS = new Set([
  "geodata.naturvardsverket.se",
  "copernicus-dem-90m.s3.amazonaws.com",
  "copernicus-dem-30m.s3.amazonaws.com",
  "geo-inspire.trafikverket.se",
  "geodata.scb.se",
]);

export function isAllowedOpenGeodataUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return ALLOWED_HOSTS.has(parsed.hostname.toLowerCase());
}

export async function fetchOpenGeodataText(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const response = await fetchOpenGeodata(url, { timeoutMs, accept: "application/json, application/geo+json, text/plain, text/xml, application/xml" });
  return await response.text();
}

export async function fetchOpenGeodataBytes(url, { timeoutMs = 180_000 } = {}) {
  const response = await fetchOpenGeodata(url, { timeoutMs, accept: "application/octet-stream, image/tiff, application/zip, */*" });
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchOpenGeodata(url, { timeoutMs, accept }) {
  if (!isAllowedOpenGeodataUrl(url)) {
    throw new Error("Refusing to fetch a host that is not on the open-geodata allowlist.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept,
        "user-agent": OPEN_GEODATA_USER_AGENT,
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`Open geodata fetch HTTP ${response.status} for ${new URL(url).hostname}`);
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export function parseGeoJsonFeatureCollection(text) {
  const parsed = JSON.parse(text);
  if (!parsed || parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    throw new Error("Open geodata response was not a GeoJSON FeatureCollection.");
  }
  return parsed;
}
