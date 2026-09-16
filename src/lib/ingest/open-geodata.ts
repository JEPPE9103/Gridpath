const DEFAULT_TIMEOUT_MS = 60_000;

export const OPEN_GEODATA_USER_AGENT =
  "NOXHEIM/1.0 (+https://www.noxheim.com; official-source-ingest; open-geodata)";

const ALLOWED_HOSTS = new Set([
  "geodata.naturvardsverket.se",
  "copernicus-dem-90m.s3.amazonaws.com",
  "copernicus-dem-30m.s3.amazonaws.com",
  "geo-inspire.trafikverket.se",
  "geodata.scb.se",
  "inspire.mcf.se",
  "api.sgu.se",
  "ext-dokument.lansstyrelsen.se",
]);

export function isAllowedOpenGeodataUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && ALLOWED_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export async function fetchOpenGeodataText(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const bytes = await fetchOpenGeodata(url, timeoutMs, "application/json, application/geo+json, text/plain, text/xml");
  return new TextDecoder().decode(bytes);
}

export async function fetchOpenGeodataBytes(url: string, timeoutMs = 180_000): Promise<Uint8Array> {
  return fetchOpenGeodata(url, timeoutMs, "application/octet-stream, image/tiff, application/zip, */*");
}

async function fetchOpenGeodata(url: string, timeoutMs: number, accept: string): Promise<Uint8Array> {
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
    return new Uint8Array(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}
