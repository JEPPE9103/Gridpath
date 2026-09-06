import { createHash } from "node:crypto";
import { OFFICIAL_EI_NUP_SOURCE_SLUG } from "@/lib/domain/grid-intelligence";
import {
  MONITOR_USER_AGENT,
  OFFICIAL_EI_NUP_LANDING_URLS,
  OFFICIAL_SOURCE_LANDING_URLS,
  isAllowedOfficialFetchUrl,
  type MonitorOfficialSourceSlug,
} from "@/lib/monitor/official-sources";
import { classifyIngestError, withTransientRetries } from "@/lib/monitor/errors";

export type OfficialSourceProbeResult = {
  landingUrl: string;
  discoveredUrl: string;
  fingerprint: string;
};

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function discoverNupXlsxUrl(html: string, landingUrl: string): string {
  const candidates: { url: string; score: number }[] = [];
  const matches = html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const match of matches) {
    const attrs = match[1] ?? "";
    const hrefMatch = attrs.match(/\bhref\s*=\s*"([^"]+)"/i);
    if (!hrefMatch) {
      continue;
    }
    const href = hrefMatch[1];
    let decoded = href;
    try {
      decoded = decodeURIComponent(href);
    } catch {
      decoded = href;
    }
    if (!/\.xlsx(?:$|[?#])/i.test(href) && !/\.xlsx(?:$|[?#])/i.test(decoded)) {
      continue;
    }
    const text = stripTags(match[2] ?? "").toLowerCase();
    const hrefLower = decoded.toLowerCase();
    const score =
      (text.includes("nätutveckling") ||
      hrefLower.includes("nätutveckling") ||
      hrefLower.includes("natutveckling")
        ? 2
        : 0) +
      (text.includes("karttjänst") ||
      hrefLower.includes("karttjanst") ||
      hrefLower.includes("karttjänst")
        ? 2
        : 0) +
      1;
    candidates.push({ url: new URL(href, landingUrl).href, score });
  }
  candidates.sort((left, right) => right.score - left.score);
  if (!candidates[0]) {
    throw new Error("Could not discover the official Ei NUP Excel on the landing page.");
  }
  return candidates[0].url;
}

function discoverLokalnatZipUrl(html: string, landingUrl: string): string {
  const matches = html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const match of matches) {
    const attrs = match[1] ?? "";
    const hrefMatch = attrs.match(/\bhref\s*=\s*"([^"]+)"/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];
    if (!/\.zip(?:$|[?#])/i.test(href)) continue;
    const text = stripTags(match[2] ?? "").toLowerCase();
    const lokal = text.includes("lokalnät") || text.includes("lokalnat");
    const region = text.includes("regionnät") || text.includes("regionnat");
    if (lokal && !region) {
      return new URL(href, landingUrl).href;
    }
  }
  throw new Error("Could not discover the official Ei lokalnät ZIP on the landing page.");
}

async function fetchText(url: string): Promise<string> {
  if (!isAllowedOfficialFetchUrl(url)) {
    throw new Error(`Refusing to fetch non-allowlisted host: ${url}`);
  }
  return withTransientRetries(async () => {
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": MONITOR_USER_AGENT },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      const cause =
        error instanceof Error && error.cause && typeof error.cause === "object"
          ? (error.cause as { code?: string; message?: string })
          : null;
      throw new Error(
        `Official fetch failed phase=probe host=${new URL(url).hostname} name=${error instanceof Error ? error.name : "Error"} message=${error instanceof Error ? error.message : String(error)} causeCode=${cause?.code ?? "none"} causeMessage=${cause?.message ?? "none"}`,
        { cause: error instanceof Error ? error : undefined },
      );
    }
    if (!response.ok) {
      const error = new Error(`Fetch failed (${response.status}) for landing page`);
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        Object.assign(error, { permanent: true });
      }
      throw error;
    }
    return response.text();
  }, { label: "official-landing" });
}

async function headFingerprint(url: string): Promise<string> {
  if (!isAllowedOfficialFetchUrl(url)) {
    throw new Error("Discovered source URL is not on an allowlisted official host.");
  }
  return withTransientRetries(async () => {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "user-agent": MONITOR_USER_AGENT },
    });
    if (!response.ok) {
      throw new Error(`Source HEAD failed (${response.status})`);
    }
    const etag = response.headers.get("etag") ?? "";
    const lastModified = response.headers.get("last-modified") ?? "";
    const length = response.headers.get("content-length") ?? "";
    const finalUrl = response.url || url;
    return createHash("sha256")
      .update([finalUrl, etag, lastModified, length].join("|"))
      .digest("hex");
  }, { label: "official-head" });
}

export async function probeOfficialSource(
  slug: MonitorOfficialSourceSlug,
): Promise<OfficialSourceProbeResult> {
  const landingUrls =
    slug === OFFICIAL_EI_NUP_SOURCE_SLUG
      ? [...OFFICIAL_EI_NUP_LANDING_URLS]
      : [OFFICIAL_SOURCE_LANDING_URLS[slug]];
  let lastError: unknown;
  for (const landingUrl of landingUrls) {
    try {
      const html = await fetchText(landingUrl);
      const discoveredUrl =
        slug === OFFICIAL_EI_NUP_SOURCE_SLUG
          ? discoverNupXlsxUrl(html, landingUrl)
          : discoverLokalnatZipUrl(html, landingUrl);
      const fingerprint = await headFingerprint(discoveredUrl);
      return { landingUrl, discoveredUrl, fingerprint };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Official source probe failed.");
}

export function probeErrorCode(error: unknown): string {
  const classified = classifyIngestError(error);
  if (classified === "transient_fetch" || classified === "source_format" || classified === "database") {
    return classified;
  }
  return "probe_failed";
}
