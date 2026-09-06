import { handleEiConnectivityRequest } from "@/lib/monitor/ei-connectivity-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  return handleEiConnectivityRequest(request);
}

export async function HEAD(request: Request) {
  return handleEiConnectivityRequest(request);
}
