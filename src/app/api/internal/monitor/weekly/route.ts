import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/monitor/cron-auth";
import { runWeeklyMonitor } from "@/lib/monitor/jobs";
import { sanitizeIngestError } from "@/lib/monitor/errors";
import { createRunId, logError, logEvent } from "@/lib/observability/log";
import { getSupabaseServiceRoleKey } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: Request) {
  const runId = createRunId("cron_weekly");
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
    const result = await runWeeklyMonitor();
    logEvent("monitor.weekly.ok", { runId, result });
    return NextResponse.json({ ok: true, runId, result });
  } catch (error) {
    logError("monitor.weekly.failed", {
      runId,
      message: sanitizeIngestError(error instanceof Error ? error.message : "failed"),
    });
    return NextResponse.json({ ok: false, error: "Weekly digest failed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
