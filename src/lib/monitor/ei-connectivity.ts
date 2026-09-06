import { sanitizeIngestError } from "@/lib/monitor/errors";
import {
  MONITOR_USER_AGENT,
  OFFICIAL_EI_NUP_LANDING_URLS,
  isAllowedOfficialFetchUrl,
} from "@/lib/monitor/official-sources";

export const EI_CONNECTIVITY_TIMEOUT_MS = 20_000;

export const EI_CONNECTIVITY_TARGETS = [
  { id: "nup-map-service", url: OFFICIAL_EI_NUP_LANDING_URLS[0] },
  { id: "nup-open-data", url: OFFICIAL_EI_NUP_LANDING_URLS[1] },
] as const;

export type EiConnectivityError = {
  name: string;
  message: string;
  causeCode: string | null;
  causeMessage: string | null;
};

export type EiConnectivityProbe = {
  id: string;
  requestedHost: string;
  finalHost: string | null;
  status: number | null;
  durationMs: number;
  contentType: string | null;
  success: boolean;
  error: EiConnectivityError | null;
};

export type EiConnectivityResult = {
  ok: boolean;
  probes: EiConnectivityProbe[];
};

type FetchLike = typeof fetch;

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function describeError(error: unknown): EiConnectivityError {
  const err = error instanceof Error ? error : new Error(String(error));
  const cause =
    err.cause && typeof err.cause === "object"
      ? (err.cause as { name?: string; code?: string; message?: string })
      : null;
  const code = cause?.code ?? (err as Error & { code?: string }).code ?? null;
  return {
    name: err.name || "Error",
    message: sanitizeIngestError(err.message),
    causeCode: code ? sanitizeIngestError(code) : null,
    causeMessage: cause?.message ? sanitizeIngestError(cause.message) : null,
  };
}

async function discardBody(response: Response) {
  try {
    await response.body?.cancel();
  } catch {
    // Connectivity diagnostic must not retain or return the official page body.
  }
}

export async function probeOfficialEiConnectivity(
  fetchImpl: FetchLike = fetch,
): Promise<EiConnectivityResult> {
  const probes: EiConnectivityProbe[] = [];

  for (const target of EI_CONNECTIVITY_TARGETS) {
    const requestedHost = hostnameOf(target.url) ?? "invalid";
    const started = Date.now();
    if (!isAllowedOfficialFetchUrl(target.url)) {
      probes.push({
        id: target.id,
        requestedHost,
        finalHost: null,
        status: null,
        durationMs: 0,
        contentType: null,
        success: false,
        error: {
          name: "Error",
          message: "Refusing non-allowlisted official host.",
          causeCode: null,
          causeMessage: null,
        },
      });
      continue;
    }

    try {
      const response = await fetchImpl(target.url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "user-agent": MONITOR_USER_AGENT,
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(EI_CONNECTIVITY_TIMEOUT_MS),
      });
      await discardBody(response);
      const finalHost = hostnameOf(response.url || target.url);
      const allowlisted = isAllowedOfficialFetchUrl(response.url || target.url);
      const success = response.ok && allowlisted;
      probes.push({
        id: target.id,
        requestedHost,
        finalHost,
        status: response.status,
        durationMs: Date.now() - started,
        contentType: response.headers.get("content-type"),
        success,
        error: success
          ? null
          : {
              name: "Error",
              message: allowlisted
                ? `Official fetch HTTP ${response.status}`
                : "Redirected off allowlisted official host.",
              causeCode: allowlisted ? String(response.status) : "redirect",
              causeMessage: null,
            },
      });
    } catch (error) {
      probes.push({
        id: target.id,
        requestedHost,
        finalHost: null,
        status: null,
        durationMs: Date.now() - started,
        contentType: null,
        success: false,
        error: describeError(error),
      });
    }
  }

  return {
    ok: probes.length > 0 && probes.every((probe) => probe.success),
    probes,
  };
}
