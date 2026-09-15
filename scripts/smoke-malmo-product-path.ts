/**
 * Product-path Malmö smoke (same orchestrator as server actions).
 * Does not call operator CLI ingest scripts.
 * Never prints secrets.
 */
import { createClient } from "@supabase/supabase-js";
import { ensureSearchAreaEvidence } from "../src/lib/ingest/orchestrate";
import { resolveNmd2023Tif } from "../src/lib/ingest/nmd";
import { DESIGN_PARTNER_CLOUD_PROJECT_REF, runSupabase } from "./lib/ingest-target.mjs";

const MALMO = { west: 12.95, south: 55.55, east: 13.1, north: 55.65 };

function parseEnv(text: string) {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1] ?? ""] = value;
  }
  return values;
}

function loadCloudServiceClient() {
  const keys = parseEnv(runSupabase(["projects", "api-keys", "--project-ref", DESIGN_PARTNER_CLOUD_PROJECT_REF, "-o", "env"]));
  const url = `https://${DESIGN_PARTNER_CLOUD_PROJECT_REF}.supabase.co`;
  const key = keys.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Cloud service role key unavailable from supabase CLI.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function layerStatus(coverage: Record<string, unknown> | null, key: string) {
  const layer = coverage?.[key] as { status?: string } | undefined;
  return layer?.status ?? "unknown";
}

async function main() {
  const nmdPath = resolveNmd2023Tif();
  console.log(
    JSON.stringify({
      event: "smoke.env",
      cloudProject: DESIGN_PARTNER_CLOUD_PROJECT_REF,
      serviceRole: "PRESENT",
      nmdTif: nmdPath ? "PRESENT" : "MISSING",
      geodataCacheEnv: process.env.NOXHEIM_GEODATA_CACHE ? "PRESENT" : "MISSING",
      note: "Vercel production env not readable (CLI logged out). Copernicus/RoadLink need no extra keys.",
    }),
  );

  const client = loadCloudServiceClient();
  const { data: before, error: beforeError } = await client.rpc("get_search_area_coverage", {
    p_west: MALMO.west,
    p_south: MALMO.south,
    p_east: MALMO.east,
    p_north: MALMO.north,
  });
  if (beforeError) throw new Error(beforeError.message);

  const t1 = Date.now();
  const first = await ensureSearchAreaEvidence({
    service: client,
    coverageClient: client,
    bbox: MALMO,
  });
  const firstMs = Date.now() - t1;

  const { data: after } = await client.rpc("get_search_area_coverage", {
    p_west: MALMO.west,
    p_south: MALMO.south,
    p_east: MALMO.east,
    p_north: MALMO.north,
  });

  const t2 = Date.now();
  const second = await ensureSearchAreaEvidence({
    service: client,
    coverageClient: client,
    bbox: MALMO,
  });
  const secondMs = Date.now() - t2;

  console.log(
    JSON.stringify(
      {
        event: "smoke.malmo.product_path",
        bbox: MALMO,
        firstMs,
        secondMs,
        before: {
          nmd: layerStatus(before, "nmd"),
          copernicus: layerStatus(before, "copernicus"),
          roadlink: layerStatus(before, "roadlink"),
          protected: layerStatus(before, "protectedAreas"),
          natura: layerStatus(before, "natura2000"),
          ei: layerStatus(before, "eiNetworkAreas"),
          nup: layerStatus(before, "nup"),
        },
        after: {
          nmd: layerStatus(after, "nmd"),
          copernicus: layerStatus(after, "copernicus"),
          roadlink: layerStatus(after, "roadlink"),
          protected: layerStatus(after, "protectedAreas"),
          natura: layerStatus(after, "natura2000"),
          ei: layerStatus(after, "eiNetworkAreas"),
          nup: layerStatus(after, "nup"),
        },
        firstFetched: first.fetched,
        firstReused: first.reusedCache,
        firstSources: first.sources,
        firstMessages: first.messages,
        secondFetched: second.fetched,
        secondReused: second.reusedCache,
        secondSources: second.sources,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
