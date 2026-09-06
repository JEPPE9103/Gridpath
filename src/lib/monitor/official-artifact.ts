import { createHash } from "node:crypto";
import {
  OFFICIAL_EI_NETWORK_AREA_SOURCE_SLUG,
  OFFICIAL_EI_NUP_SOURCE_SLUG,
} from "@/lib/domain/grid-intelligence";
import { sanitizeIngestError } from "@/lib/monitor/errors";
import {
  MONITOR_USER_AGENT,
  OFFICIAL_EI_NUP_LANDING_URLS,
  OFFICIAL_SOURCE_LANDING_URLS,
  isAllowedOfficialFetchUrl,
} from "@/lib/monitor/official-sources";

export const OFFICIAL_SOURCE_CACHE_BUCKET = "official-source-cache";
export const OFFICIAL_CACHE_TIMEOUT_MS = 20_000;

export const CACHED_OFFICIAL_SOURCE_SLUGS = [
  OFFICIAL_EI_NUP_SOURCE_SLUG,
  OFFICIAL_EI_NETWORK_AREA_SOURCE_SLUG,
] as const;

export type CachedOfficialSourceSlug = (typeof CACHED_OFFICIAL_SOURCE_SLUGS)[number];
export type OfficialArtifactKind = "xlsx" | "zip";
export type OfficialArtifactProcessingStatus = "cached" | "processed" | "failed";

export type OfficialArtifactRecord = {
  sourceSlug: CachedOfficialSourceSlug;
  sourceKind: OfficialArtifactKind;
  officialSourceUrl: string;
  discoveryPageUrl: string;
  fetchedAt: string;
  contentSha256: string;
  byteSize: number;
  contentType: string | null;
  originalFilename: string;
  storagePath: string;
  processingStatus: OfficialArtifactProcessingStatus;
};

export type OfficialCacheOutcome =
  | { outcome: "unchanged"; artifact: OfficialArtifactRecord }
  | { outcome: "cached"; artifact: OfficialArtifactRecord }
  | { outcome: "failed"; sourceSlug: CachedOfficialSourceSlug; error: string };

type FetchLike = typeof fetch;

export type OfficialCacheStore = {
  findByHash(
    slug: CachedOfficialSourceSlug,
    sha256: string,
  ): Promise<OfficialArtifactRecord | null>;
  insert(record: OfficialArtifactRecord, bytes: Uint8Array): Promise<void>;
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

export function isCachedOfficialSourceSlug(value: string): value is CachedOfficialSourceSlug {
  return (CACHED_OFFICIAL_SOURCE_SLUGS as readonly string[]).includes(value);
}

export function officialCacheObjectPath(
  slug: CachedOfficialSourceSlug,
  sha256: string,
  kind: OfficialArtifactKind,
): string {
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error("Invalid official artifact hash.");
  }
  if (!isCachedOfficialSourceSlug(slug)) {
    throw new Error("Unsupported official source slug.");
  }
  return `ei/${slug}/${sha256}.${kind}`;
}

export function looksLikeHtml(bytes: Uint8Array): boolean {
  const head = Buffer.from(bytes.subarray(0, 256)).toString("utf8").trimStart();
  return /^(<!doctype\s+html|<html|<head|<body)/i.test(head);
}

export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function assertOfficialBinaryDownload(
  bytes: Uint8Array,
  {
    url,
    contentType,
    kind = "xlsx",
  }: { url?: string; contentType?: string | null; kind?: OfficialArtifactKind } = {},
): void {
  if (url && !isAllowedOfficialFetchUrl(url)) {
    throw new Error("Official download URL is not on an allowlisted Ei host.");
  }
  if (!bytes.length) {
    throw new Error(`Official ${kind} download was empty.`);
  }
  const type = String(contentType ?? "").toLowerCase();
  if (type.includes("text/html") || looksLikeHtml(bytes)) {
    throw new Error(
      `Official ${kind} download was HTML, not the expected binary file. Refusing to ingest an error page.`,
    );
  }
  if (!looksLikeZip(bytes)) {
    throw new Error(
      `Official ${kind} download is not a ZIP/XLSX binary (content-type=${contentType || "unknown"}, bytes=${bytes.length}).`,
    );
  }
}

export function discoverNupXlsxUrl(html: string, landingUrl: string): string {
  const candidates: { url: string; score: number }[] = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = match[1] ?? "";
    const hrefMatch = attrs.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
    if (!hrefMatch) continue;
    const href = (hrefMatch[1] || hrefMatch[2] || "").replaceAll("&amp;", "&");
    let decoded = href;
    try {
      decoded = decodeURIComponent(href);
    } catch {
      decoded = href;
    }
    if (!/\.xlsx(?:$|[?#])/i.test(href) && !/\.xlsx(?:$|[?#])/i.test(decoded)) continue;
    const text = stripTags(match[2] ?? "").toLowerCase();
    const hrefLower = decoded.toLowerCase();
    const score =
      (text.includes("data karttjänsten") ||
      hrefLower.includes("data-karttjansten") ||
      hrefLower.includes("data-karttjänsten")
        ? 3
        : 0) +
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
  if (!candidates.length) {
    for (const match of html.matchAll(/href\s*=\s*(?:"([^"]+\.xlsx[^"]*)"|'([^']+\.xlsx[^']*)')/gi)) {
      const href = (match[1] || match[2] || "").replaceAll("&amp;", "&");
      candidates.push({ url: new URL(href, landingUrl).href, score: 1 });
    }
  }
  candidates.sort((left, right) => right.score - left.score);
  const chosen = candidates[0];
  if (!chosen || !isAllowedOfficialFetchUrl(chosen.url)) {
    throw new Error(
      "Could not discover the official Ei NUP Excel on the landing page. Refusing to use a hardcoded stale URL.",
    );
  }
  return chosen.url;
}

export function discoverLokalnatZipUrl(html: string, landingUrl: string): string {
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = match[1] ?? "";
    const hrefMatch = attrs.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
    if (!hrefMatch) continue;
    const href = (hrefMatch[1] || hrefMatch[2] || "").replaceAll("&amp;", "&");
    if (!/\.zip(?:$|[?#])/i.test(href)) continue;
    const text = stripTags(match[2] ?? "").toLowerCase();
    const lokal = text.includes("lokalnät") || text.includes("lokalnat");
    const region = text.includes("regionnät") || text.includes("regionnat");
    if (lokal && !region) {
      const url = new URL(href, landingUrl).href;
      if (!isAllowedOfficialFetchUrl(url)) {
        throw new Error("Discovered lokalnät ZIP URL is not on an allowlisted official Ei host.");
      }
      return url;
    }
  }
  throw new Error(
    "Could not discover the official Ei lokalnät ZIP on the landing page. Refusing to use a hardcoded stale URL.",
  );
}

async function officialGet(
  url: string,
  fetchImpl: FetchLike,
  responseType: "text" | "bytes",
): Promise<{ url: string; status: number; contentType: string | null; text?: string; bytes?: Uint8Array }> {
  if (!isAllowedOfficialFetchUrl(url)) {
    throw new Error(`Refusing to fetch non-allowlisted host: ${new URL(url).hostname}`);
  }
  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": MONITOR_USER_AGENT,
      accept:
        responseType === "bytes"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,application/octet-stream,*/*"
          : "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(OFFICIAL_CACHE_TIMEOUT_MS),
  });
  const finalUrl = response.url || url;
  if (!isAllowedOfficialFetchUrl(finalUrl)) {
    throw new Error("Redirected off allowlisted official host.");
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Official fetch HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type");
  if (responseType === "text") {
    return { url: finalUrl, status: response.status, contentType, text: await response.text() };
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { url: finalUrl, status: response.status, contentType, bytes };
}

async function discoverOfficialFile(
  slug: CachedOfficialSourceSlug,
  fetchImpl: FetchLike,
): Promise<{ discoveryPageUrl: string; officialSourceUrl: string; kind: OfficialArtifactKind }> {
  if (slug === OFFICIAL_EI_NUP_SOURCE_SLUG) {
    const errors: string[] = [];
    for (const pageUrl of OFFICIAL_EI_NUP_LANDING_URLS) {
      try {
        const page = await officialGet(pageUrl, fetchImpl, "text");
        const officialSourceUrl = discoverNupXlsxUrl(page.text ?? "", page.url);
        return { discoveryPageUrl: pageUrl, officialSourceUrl, kind: "xlsx" };
      } catch (error) {
        errors.push(`${pageUrl}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    throw new Error(`Could not discover official NUP Excel. ${errors.join(" | ")}`);
  }

  const landingUrl = OFFICIAL_SOURCE_LANDING_URLS[slug];
  const page = await officialGet(landingUrl, fetchImpl, "text");
  return {
    discoveryPageUrl: landingUrl,
    officialSourceUrl: discoverLokalnatZipUrl(page.text ?? "", page.url),
    kind: "zip",
  };
}

function filenameFromUrl(url: string, kind: OfficialArtifactKind): string {
  const name = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() || "");
  return name || `official.${kind}`;
}

export async function cacheOfficialSourceArtifact(
  slug: CachedOfficialSourceSlug,
  {
    fetchImpl = fetch,
    store,
    now = new Date(),
  }: {
    fetchImpl?: FetchLike;
    store: OfficialCacheStore;
    now?: Date;
  },
): Promise<OfficialCacheOutcome> {
  try {
    const discovered = await discoverOfficialFile(slug, fetchImpl);
    const downloaded = await officialGet(discovered.officialSourceUrl, fetchImpl, "bytes");
    const bytes = downloaded.bytes ?? new Uint8Array();
    assertOfficialBinaryDownload(bytes, {
      url: downloaded.url,
      contentType: downloaded.contentType,
      kind: discovered.kind,
    });
    const contentSha256 = createHash("sha256").update(bytes).digest("hex");
    const existing = await store.findByHash(slug, contentSha256);
    if (existing) {
      return { outcome: "unchanged", artifact: existing };
    }
    const artifact: OfficialArtifactRecord = {
      sourceSlug: slug,
      sourceKind: discovered.kind,
      officialSourceUrl: downloaded.url,
      discoveryPageUrl: discovered.discoveryPageUrl,
      fetchedAt: now.toISOString(),
      contentSha256,
      byteSize: bytes.length,
      contentType: downloaded.contentType,
      originalFilename: filenameFromUrl(downloaded.url, discovered.kind),
      storagePath: officialCacheObjectPath(slug, contentSha256, discovered.kind),
      processingStatus: "cached",
    };
    await store.insert(artifact, bytes);
    return { outcome: "cached", artifact };
  } catch (error) {
    return {
      outcome: "failed",
      sourceSlug: slug,
      error: sanitizeIngestError(error instanceof Error ? error.message : String(error)),
    };
  }
}

export async function refreshOfficialSourceCache(deps: {
  fetchImpl?: FetchLike;
  store: OfficialCacheStore;
  now?: Date;
}): Promise<{ ok: boolean; sources: OfficialCacheOutcome[] }> {
  const sources: OfficialCacheOutcome[] = [];
  for (const slug of CACHED_OFFICIAL_SOURCE_SLUGS) {
    sources.push(await cacheOfficialSourceArtifact(slug, deps));
  }
  return {
    ok: sources.every((item) => item.outcome !== "failed"),
    sources,
  };
}

export function publicArtifactMetadata(record: OfficialArtifactRecord) {
  return {
    officialPublisher: "Energimarknadsinspektionen",
    officialSourceUrl: record.officialSourceUrl,
    discoveryPageUrl: record.discoveryPageUrl,
    retrievedByNoxheimAt: record.fetchedAt,
    artifactSha256: record.contentSha256,
    byteSize: record.byteSize,
    originalFilename: record.originalFilename,
    sourceKind: record.sourceKind,
    processingStatus: record.processingStatus,
    cacheIsTransportOnly: true,
  };
}
