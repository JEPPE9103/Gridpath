/**
 * HTTPS client for allowlisted Swedish open geodata hosts.
 * Separate from the Ei client: do not mix host allowlists.
 */
import dns from "node:dns";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // ignore
}

export const OPEN_GEODATA_USER_AGENT =
  "NOXHEIM/1.0 (+https://www.noxheim.com; official-source-ingest; Naturvardsverket WFS)";

const DEFAULT_TIMEOUT_MS = 60_000;

export function isAllowedOpenGeodataUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return host === "geodata.naturvardsverket.se";
}

export async function fetchOpenGeodataText(url, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!isAllowedOpenGeodataUrl(url)) {
    throw new Error("Refusing to fetch a host that is not on the open-geodata allowlist.");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        accept: "application/json, application/geo+json, text/plain",
        "user-agent": OPEN_GEODATA_USER_AGENT,
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`Open geodata fetch HTTP ${response.status} for ${new URL(url).hostname}`);
    }
    return await response.text();
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
