import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/monitor/cron-auth";
import { runDailyMonitor } from "@/lib/monitor/jobs";
import { sanitizeIngestError } from "@/lib/monitor/errors";
import { createRunId, logError, logEvent } from "@/lib/observability/log";
import { getSupabaseServiceRoleKey } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request) {
  const runId = createRunId("cron_daily");
  if (!authorizeCronRequest(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!getSupabaseServiceRoleKey()) {
    return NextResponse.json(
      { ok: false, error: "Monitor is not configured." },
      { status: 503 },
    );
  }
  try {
    const result = await runDailyMonitor();
    logEvent("monitor.daily.ok", { runId, result });
    return NextResponse.json({ ok: true, runId, result });
  } catch (error) {
    logError("monitor.daily.failed", {
      runId,
      message: sanitizeIngestError(error instanceof Error ? error.message : "failed"),
    });
    return NextResponse.json({ ok: false, error: "Monitor run failed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
