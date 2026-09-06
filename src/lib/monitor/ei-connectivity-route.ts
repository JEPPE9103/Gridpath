import { NextResponse } from "next/server";
import { authorizeCronRequest } from "@/lib/monitor/cron-auth";
import { probeOfficialEiConnectivity } from "@/lib/monitor/ei-connectivity";

type FetchLike = typeof fetch;

export async function handleEiConnectivityRequest(
  request: Request,
  {
    fetchImpl = fetch,
    secret = process.env.CRON_SECRET,
  }: {
    fetchImpl?: FetchLike;
    secret?: string;
  } = {},
) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }
  if (!authorizeCronRequest(request, secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (request.method === "HEAD") {
    return new NextResponse(null, { status: 204 });
  }

  const result = await probeOfficialEiConnectivity(fetchImpl);
  return NextResponse.json(
    {
      ok: result.ok,
      probes: result.probes,
    },
    { status: result.ok ? 200 : 503 },
  );
}
