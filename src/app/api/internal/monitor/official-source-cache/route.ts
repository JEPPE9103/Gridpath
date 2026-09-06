import { handleOfficialSourceCacheRequest } from "@/lib/monitor/official-cache-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  return handleOfficialSourceCacheRequest(request);
}

export async function POST(request: Request) {
  return handleOfficialSourceCacheRequest(request);
}

export async function HEAD(request: Request) {
  return handleOfficialSourceCacheRequest(request);
}
