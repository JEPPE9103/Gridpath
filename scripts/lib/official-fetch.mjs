/**
 * Official Ei HTTPS client for scheduled ingest.
 *
 * GitHub Actions run #2 failed in fetchText() against ei.se with undici's
 * opaque "fetch failed" (no HTTP status). Local Windows and Ubuntu Node 20
 * both reach Ei; ei.se is IPv4-only behind SiteVision/F5. This client records
 * the low-level cause, prefers IPv4, retries transient transport errors, and
 * falls back Node fetch → Node https (HTTP/1.1) → curl when evidence shows a
 * transport failure. TLS verification stays on. No third-party mirrors.
 */
import { execFile } from "node:child_process";
import dns from "node:dns";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Node without --dns-result-order support; family: 4 still applies below.
}

export const OFFICIAL_USER_AGENT =
  "NOXHEIM/1.0 (+https://www.noxheim.com; official-source-ingest; public Ei retrieval)";

export const NUP_DISCOVERY_URLS = [
  "https://ei.se/bransch/natutvecklingsplaner/karttjanst-natutvecklingsplaner",
  "https://ei.se/om-oss/statistik-och-oppna-data/natutvecklingsplaner---elnat",
];

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;
const MAX_FETCH_ATTEMPTS = 3;

export function preferIpv4() {
  try {
    dns.setDefaultResultOrder("ipv4first");
  } catch {
    // ignore
  }
}

export function isAllowedOfficialFetchUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  return host === "ei.se" || host.endsWith(".ei.se");
}

export function sanitizeFetchDiagnostic(value) {
  return String(value ?? "")
    .replace(/:\/\/[^/\s]+@/g, "://***@")
    .replace(/(service_role|eyJ[A-Za-z0-9_-]{20,})/g, "[redacted]")
    .replace(/authorization:\s*\S+/gi, "authorization:[redacted]")
    .replace(/cookie:\s*[^;]+/gi, "cookie:[redacted]")
    .slice(0, 400);
}

export function describeFetchFailure(error, context = {}) {
  const cause =
    error && typeof error === "object" && "cause" in error ? error.cause : undefined;
  const causeRecord = cause && typeof cause === "object" ? cause : null;
  const hostname =
    context.hostname ??
    (typeof context.url === "string" ? safeHostname(context.url) : null);
  return {
    name: error?.name ?? "Error",
    message: sanitizeFetchDiagnostic(error?.message ?? error),
    causeName: causeRecord?.name ?? null,
    causeCode: causeRecord?.code ?? error?.code ?? null,
    causeMessage: sanitizeFetchDiagnostic(causeRecord?.message),
    hostname: hostname ?? null,
    phase: context.phase ?? null,
    transport: context.transport ?? error?.transport ?? null,
    status: context.status ?? error?.status ?? null,
  };
}

export function formatFetchError(error, context = {}) {
  const detail = describeFetchFailure(error, context);
  return [
    "Official fetch failed",
    detail.phase ? `phase=${detail.phase}` : null,
    detail.hostname ? `host=${detail.hostname}` : null,
    detail.transport ? `transport=${detail.transport}` : null,
    detail.status != null ? `status=${detail.status}` : null,
    `name=${detail.name}`,
    `message=${detail.message}`,
    `causeCode=${detail.causeCode ?? "none"}`,
    `causeMessage=${detail.causeMessage || "none"}`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function ingestErrorText(error) {
  if (error == null) {
    return "";
  }
  if (typeof error !== "object") {
    return String(error);
  }
  const cause = "cause" in error ? error.cause : undefined;
  const causeRecord = cause && typeof cause === "object" ? cause : null;
  return [
    error.message,
    error.code,
    causeRecord?.code,
    causeRecord?.message,
    cause instanceof Error ? cause.message : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function isPermanentHttpStatus(status) {
  return Number.isInteger(status) && status >= 400 && status < 500 && status !== 408 && status !== 429;
}

export function isTransientFetchFailure(error) {
  if (error?.permanent === true) {
    return false;
  }
  if (isPermanentHttpStatus(error?.status)) {
    return false;
  }
  const text = ingestErrorText(error);
  return /failed to fetch|fetch failed|econnreset|etimedout|enotfound|eai_again|enetunreach|econnrefused|ehostunreach|eproto|und_err|socket|timeout|aborted|network| 408 | 429 | 502 | 503 | 504 /i.test(
    text,
  );
}

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function defaultBackoffMs(attempt) {
  return 400 * 2 ** (attempt - 1);
}

function sleep(ms, sleepFn) {
  return (sleepFn ?? ((delay) => new Promise((resolve) => setTimeout(resolve, delay))))(ms);
}

function headerBag(headers) {
  const raw = headers ?? {};
  if (typeof raw.get === "function") {
    return raw;
  }
  return {
    get(name) {
      const key = Object.keys(raw).find((item) => item.toLowerCase() === name.toLowerCase());
      return key == null ? null : raw[key];
    },
  };
}

function requestHeaders(responseType, extra) {
  return {
    "user-agent": OFFICIAL_USER_AGENT,
    accept:
      responseType === "buffer"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,application/octet-stream,*/*"
        : "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    "accept-language": "sv-SE,sv;q=0.9,en;q=0.8",
    ...extra,
  };
}

function throwHttpStatus(status, url, transport) {
  const error = new Error(`Official fetch HTTP ${status} for ${safeHostname(url)}`);
  error.status = status;
  error.permanent = isPermanentHttpStatus(status);
  error.transport = transport;
  throw error;
}

function ensureAllowlisted(url, phase) {
  if (!isAllowedOfficialFetchUrl(url)) {
    const error = new Error(`Refusing to fetch non-allowlisted host during ${phase}: ${safeHostname(url) ?? "invalid-url"}`);
    error.permanent = true;
    throw error;
  }
}

async function followRedirects(startUrl, hop, phase) {
  let currentUrl = startUrl;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    ensureAllowlisted(currentUrl, phase);
    const result = await hop(currentUrl);
    const status = result.status;
    if (status >= 300 && status < 400) {
      const location = headerBag(result.headers).get("location");
      if (!location) {
        throw new Error(`Redirect ${status} missing Location during ${phase}`);
      }
      const nextUrl = new URL(location, currentUrl).href;
      ensureAllowlisted(nextUrl, `${phase}-redirect`);
      currentUrl = nextUrl;
      continue;
    }
    if (status < 200 || status >= 300) {
      throwHttpStatus(status, currentUrl, result.transport);
    }
    return { ...result, url: result.url || currentUrl, status };
  }
  throw new Error(`Too many redirects during ${phase} (max ${MAX_REDIRECTS})`);
}

async function fetchWithNodeFetch(url, { timeoutMs, headers, fetchImpl }) {
  const fetchFn = fetchImpl ?? globalThis.fetch;
  if (typeof fetchFn !== "function") {
    throw new Error("Node fetch is not available");
  }
  let dispatcher;
  if (!fetchImpl) {
    try {
      const { Agent } = await import("undici");
      dispatcher = new Agent({
        connect: {
          timeout: timeoutMs,
          family: 4,
          rejectUnauthorized: true,
        },
        headersTimeout: timeoutMs,
        bodyTimeout: timeoutMs,
      });
    } catch {
      dispatcher = undefined;
    }
  }
  const init = {
    method: "GET",
    redirect: "manual",
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (dispatcher) {
    init.dispatcher = dispatcher;
  }
  const response = await fetchFn(url, init);
  const status = response.status || 0;
  const location = typeof response.headers?.get === "function" ? response.headers.get("location") : null;
  const body = typeof response.arrayBuffer === "function" ? Buffer.from(await response.arrayBuffer()) : Buffer.alloc(0);
  return {
    status,
    url: response.url || url,
    headers: {
      "content-type":
        typeof response.headers?.get === "function" ? response.headers.get("content-type") : null,
      location,
    },
    body,
    transport: "node-fetch",
  };
}

function httpsOnce(url, { timeoutMs, headers, httpsRequestImpl, family = 4 }) {
  const parsed = new URL(url);
  const requestFn = httpsRequestImpl ?? https.request;
  return new Promise((resolve, reject) => {
    const req = requestFn(
      {
        protocol: "https:",
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: "GET",
        family,
        servername: parsed.hostname,
        rejectUnauthorized: true,
        timeout: timeoutMs,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            url,
            headers: res.headers ?? {},
            body: Buffer.concat(chunks),
            transport: "node-https",
          });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(Object.assign(new Error("socket timeout"), { code: "ETIMEDOUT" }));
    });
    req.on("error", reject);
    req.end();
  });
}

async function fetchWithCurl(url, { timeoutMs, headers, curlImpl, responseType }) {
  if (typeof curlImpl === "function") {
    const result = await curlImpl(url, { timeoutMs, headers, responseType });
    return {
      status: result.status,
      url: result.url || url,
      headers: { "content-type": result.contentType ?? null, location: result.location ?? null },
      body: Buffer.isBuffer(result.body) ? result.body : Buffer.from(result.body ?? ""),
      transport: "curl",
    };
  }

  const workDir = mkdtempSync(path.join(tmpdir(), "noxheim-official-curl-"));
  const bodyPath = path.join(workDir, "body");
  const curlBin = process.platform === "win32" ? "curl.exe" : "curl";
  const args = [
    "-sS",
    "-L",
    "--max-redirs",
    String(MAX_REDIRECTS),
    "--proto",
    "=https",
    "--proto-redir",
    "=https",
    "--compressed",
    "--max-time",
    String(Math.ceil(timeoutMs / 1000)),
    "-A",
    headers["user-agent"],
    "-H",
    `Accept: ${headers.accept}`,
    "-H",
    `Accept-Language: ${headers["accept-language"]}`,
    "-o",
    bodyPath,
    "-w",
    "%{http_code}\t%{url_effective}\t%{content_type}",
    url,
  ];
  try {
    const { stdout } = await execFileAsync(curlBin, args, {
      timeout: timeoutMs + 2000,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    });
    const [statusText, effectiveUrl, contentType] = String(stdout).trim().split("\t");
    const status = Number(statusText);
    const finalUrl = effectiveUrl || url;
    ensureAllowlisted(finalUrl, "curl-effective");
    const body = readFileSync(bodyPath);
    return {
      status,
      url: finalUrl,
      headers: { "content-type": contentType || null },
      body,
      transport: "curl",
    };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

export async function officialFetch(url, options = {}) {
  preferIpv4();
  const phase = options.phase ?? "request";
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const responseType = options.responseType ?? "text";
  const headers = requestHeaders(responseType, options.headers);
  const maxAttempts = options.maxAttempts ?? MAX_FETCH_ATTEMPTS;
  const backoffMs = options.backoffMs ?? defaultBackoffMs;
  ensureAllowlisted(url, phase);

  const transports = [
    {
      name: "node-fetch",
      run: (currentUrl) =>
        fetchWithNodeFetch(currentUrl, {
          timeoutMs,
          headers,
          fetchImpl: options.fetchImpl,
        }),
    },
    {
      name: "node-https",
      run: async (currentUrl) => {
        if (typeof options.httpsOnceImpl === "function") {
          const result = await options.httpsOnceImpl(currentUrl, { timeoutMs, headers });
          return { ...result, transport: "node-https" };
        }
        return httpsOnce(currentUrl, {
          timeoutMs,
          headers,
          httpsRequestImpl: options.httpsRequestImpl,
        });
      },
    },
    {
      name: "curl",
      run: (currentUrl) =>
        fetchWithCurl(currentUrl, {
          timeoutMs,
          headers,
          curlImpl: options.curlImpl,
          responseType,
        }),
    },
  ];

  const enabled = transports.filter((transport) => {
    if (transport.name === "node-https") {
      if (typeof options.httpsOnceImpl === "function") return true;
      if (options.httpsRequestImpl === false || options.httpsOnceImpl === false) return false;
    }
    if (transport.name === "curl" && options.curlImpl === false) return false;
    return true;
  });

  let lastError;
  for (const transport of enabled) {
    const attempts = transport.name === "node-fetch" ? maxAttempts : 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const started = Date.now();
      try {
        const result = await followRedirects(url, (currentUrl) => transport.run(currentUrl), phase);
        console.log(
          JSON.stringify({
            event: "official.fetch.ok",
            phase,
            host: safeHostname(result.url),
            status: result.status,
            transport: result.transport,
            ms: Date.now() - started,
          }),
        );
        return {
          status: result.status,
          url: result.url,
          contentType: headerBag(result.headers).get("content-type"),
          body: result.body,
          transport: result.transport,
        };
      } catch (error) {
        error.transport = error.transport ?? transport.name;
        lastError = error;
        const detail = describeFetchFailure(error, {
          hostname: safeHostname(url),
          phase,
          transport: transport.name,
          status: error.status,
        });
        const retryable = isTransientFetchFailure(error) && attempt < attempts;
        console.warn(
          JSON.stringify({
            event: retryable ? "official.fetch.retry" : "official.fetch.transport_failed",
            attempt,
            attempts,
            ...detail,
            ms: Date.now() - started,
          }),
        );
        if (error.permanent || isPermanentHttpStatus(error.status)) {
          throw new Error(formatFetchError(error, { ...detail, url }), { cause: error });
        }
        if (retryable) {
          await sleep(backoffMs(attempt), options.sleep);
        }
      }
    }
  }

  throw new Error(
    formatFetchError(lastError, {
      hostname: safeHostname(url),
      phase,
      transport: lastError?.transport,
      status: lastError?.status,
    }),
    { cause: lastError },
  );
}

export async function fetchOfficialText(url, options = {}) {
  const result = await officialFetch(url, { ...options, responseType: "text", phase: options.phase ?? "landing" });
  return {
    text: result.body.toString("utf8"),
    finalUrl: result.url,
    status: result.status,
    contentType: result.contentType,
    transport: result.transport,
  };
}

export function looksLikeHtml(bytes) {
  const head = Buffer.from(bytes).subarray(0, 256).toString("utf8").trimStart();
  return /^(<!doctype\s+html|<html|<head|<body)/i.test(head);
}

export function looksLikeZip(bytes) {
  return bytes?.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function assertOfficialBinaryDownload(bytes, { url, contentType, kind = "xlsx" } = {}) {
  if (url && !isAllowedOfficialFetchUrl(url)) {
    throw new Error("Official download URL is not on an allowlisted Ei host.");
  }
  if (!bytes || bytes.length === 0) {
    throw new Error(`Official ${kind} download was empty.`);
  }
  const type = String(contentType ?? "").toLowerCase();
  if (type.includes("text/html") || looksLikeHtml(bytes)) {
    throw new Error(`Official ${kind} download was HTML, not the expected binary file. Refusing to ingest an error page.`);
  }
  if (!looksLikeZip(bytes)) {
    throw new Error(
      `Official ${kind} download is not a ZIP/XLSX binary (content-type=${contentType || "unknown"}, bytes=${bytes.length}).`,
    );
  }
}

export async function downloadOfficialBuffer(url, options = {}) {
  const kind = options.kind ?? "xlsx";
  const result = await officialFetch(url, {
    ...options,
    responseType: "buffer",
    phase: options.phase ?? `official-${kind}`,
  });
  assertOfficialBinaryDownload(result.body, {
    url: result.url,
    contentType: result.contentType,
    kind,
  });
  const filename = decodeURIComponent(
    new URL(result.url).pathname.split("/").filter(Boolean).pop() || `download.${kind}`,
  );
  return {
    bytes: result.body,
    filename,
    finalUrl: result.url,
    contentType: result.contentType,
    transport: result.transport,
  };
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function discoverNupXlsxUrl(html, landingUrl) {
  const candidates = [];
  const matches = html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const match of matches) {
    const attrs = match[1] ?? "";
    const hrefMatch = attrs.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
    if (!hrefMatch) {
      continue;
    }
    const href = (hrefMatch[1] || hrefMatch[2] || "").replaceAll("&amp;", "&");
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
      (text.includes("data karttjänsten") || hrefLower.includes("data-karttjansten") || hrefLower.includes("data-karttjänsten")
        ? 3
        : 0) +
      (text.includes("nätutveckling") || hrefLower.includes("nätutveckling") || hrefLower.includes("natutveckling")
        ? 2
        : 0) +
      (text.includes("karttjänst") || hrefLower.includes("karttjanst") || hrefLower.includes("karttjänst")
        ? 2
        : 0) +
      1;
    candidates.push({ url: new URL(href, landingUrl).href, score, text });
  }

  if (!candidates.length) {
    for (const match of html.matchAll(/href\s*=\s*(?:"([^"]+\.xlsx[^"]*)"|'([^']+\.xlsx[^']*)')/gi)) {
      const href = (match[1] || match[2] || "").replaceAll("&amp;", "&");
      candidates.push({ url: new URL(href, landingUrl).href, score: 1, text: "" });
    }
  }

  candidates.sort((left, right) => right.score - left.score);
  const chosen = candidates[0];
  if (!chosen) {
    throw new Error(
      "Could not discover the official Ei NUP Excel on the landing page. Refusing to use a hardcoded stale URL.",
    );
  }
  if (!isAllowedOfficialFetchUrl(chosen.url)) {
    throw new Error("Discovered NUP Excel URL is not on an allowlisted official Ei host.");
  }
  return chosen.url;
}

export async function discoverOfficialNupXlsxUrl(fetchPage) {
  const failures = [];
  for (const pageUrl of NUP_DISCOVERY_URLS) {
    try {
      const page = await fetchPage(pageUrl);
      const xlsxUrl = discoverNupXlsxUrl(page.text, page.finalUrl || pageUrl);
      return {
        xlsxUrl,
        landingUrl: pageUrl,
        finalLandingUrl: page.finalUrl || pageUrl,
        transport: page.transport,
        text: page.text,
      };
    } catch (error) {
      failures.push(`${pageUrl}: ${error.message || error}`);
      console.warn(
        JSON.stringify({
          event: "nup.discovery.page_failed",
          ...describeFetchFailure(error, { hostname: "ei.se", phase: "nup-discovery", url: pageUrl }),
        }),
      );
    }
  }
  throw new Error(
    `Could not discover the official Ei NUP Excel from official landing pages. ${failures.join(" | ")}`,
  );
}
