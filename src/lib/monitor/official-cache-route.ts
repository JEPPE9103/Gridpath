import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/monitor/cron-auth";
import { refreshOfficialSourceCache, publicArtifactMetadata } from "@/lib/monitor/official-artifact";
import { createSupabaseOfficialCacheStore } from "@/lib/monitor/official-cache-store";
import { logError, logEvent } from "@/lib/observability/log";
import { createSupabaseServiceClient, getSupabaseServiceRoleKey } from "@/lib/supabase/service";

type FetchLike = typeof fetch;

export async function handleOfficialSourceCacheRequest(
  request: Request,
  {
    fetchImpl = fetch,
    secret = process.env.CRON_SECRET,
    refresh = refreshOfficialSourceCache,
    hasServiceRole = () => Boolean(getSupabaseServiceRoleKey()),
  }: {
    fetchImpl?: FetchLike;
    secret?: string;
    refresh?: typeof refreshOfficialSourceCache;
    hasServiceRole?: () => boolean;
  } = {},
) {
  if (request.method !== "GET" && request.method !== "POST" && request.method !== "HEAD") {
    return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }
  if (!authorizeCronRequest(request, secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (request.method === "HEAD") {
    return new NextResponse(null, { status: 204 });
  }
  if (!hasServiceRole()) {
    return NextResponse.json({ ok: false, error: "Monitor is not configured." }, { status: 503 });
  }

  try {
    const result =
      refresh === refreshOfficialSourceCache
        ? await refresh({
            fetchImpl,
            store: createSupabaseOfficialCacheStore(createSupabaseServiceClient()),
          })
        : await refresh({
            fetchImpl,
            store: {
              findByHash: async () => null,
              insert: async () => undefined,
            },
          });
    const sources = result.sources.map((item) => {
      if (item.outcome === "failed") {
        return { outcome: item.outcome, sourceSlug: item.sourceSlug, error: item.error };
      }
      return {
        outcome: item.outcome,
        sourceSlug: item.artifact.sourceSlug,
        ...publicArtifactMetadata(item.artifact),
      };
    });
    logEvent("monitor.official_source_cache", {
      ok: result.ok,
      outcomes: sources.map((item) => ({
        sourceSlug: item.sourceSlug,
        outcome: item.outcome,
      })),
    });
    return NextResponse.json({ ok: result.ok, sources }, { status: result.ok ? 200 : 503 });
  } catch (error) {
    logError("monitor.official_source_cache.failed", {
      message: error instanceof Error ? error.message : "failed",
    });
    return NextResponse.json({ ok: false, error: "Official source cache refresh failed." }, { status: 500 });
  }
}
