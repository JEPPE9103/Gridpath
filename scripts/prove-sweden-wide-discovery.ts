/**
 * Multi-geography proof for Sweden-wide on-demand discovery.
 * Same engine, different Search Areas. Does not fabricate Candidates.
 *
 * Local (default):
 *   node --import tsx scripts/prove-sweden-wide-discovery.ts
 *   node --import tsx scripts/prove-sweden-wide-discovery.ts --skip-fetch
 *
 * Design Partner Cloud:
 *   NOXHEIM_ALLOW_REMOTE_INGEST=true NOXHEIM_REMOTE_PROJECT_REF=krgzpgqmnzljwlwptmcn \
 *   SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_URL=https://krgzpgqmnzljwlwptmcn.supabase.co \
 *     node --import tsx scripts/prove-sweden-wide-discovery.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ensureSearchAreaEvidence } from "../src/lib/ingest/orchestrate";
import { DESIGN_PARTNER_CLOUD_PROJECT_REF, runSupabase } from "./lib/ingest-target.mjs";

type Bbox = { west: number; south: number; east: number; north: number };

const AREAS: Array<{ name: string; bbox: Bbox }> = [
  { name: "Örebro (regression)", bbox: { west: 14.9, south: 59.1, east: 15.4, north: 59.4 } },
  { name: "Malmö / Skåne", bbox: { west: 12.95, south: 55.55, east: 13.1, north: 55.65 } },
  { name: "Göteborg", bbox: { west: 11.85, south: 57.65, east: 12.05, north: 57.78 } },
];

function parseEnvOutput(text: string): Record<string, string> {
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

function resolveClient(): { client: SupabaseClient; mode: "local" | "remote" } {
  const allowRemote = process.env.NOXHEIM_ALLOW_REMOTE_INGEST === "true";
  const expected = (process.env.NOXHEIM_REMOTE_PROJECT_REF || "").trim();
  if (allowRemote) {
    if (expected !== DESIGN_PARTNER_CLOUD_PROJECT_REF) {
      throw new Error(`NOXHEIM_REMOTE_PROJECT_REF must be ${DESIGN_PARTNER_CLOUD_PROJECT_REF}`);
    }
    const url = process.env.SUPABASE_URL?.trim() || `https://${DESIGN_PARTNER_CLOUD_PROJECT_REF}.supabase.co`;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for remote proof.");
    return {
      client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
      mode: "remote",
    };
  }

  const status = parseEnvOutput(runSupabase(["status", "-o", "env"]));
  const url = process.env.SUPABASE_URL?.trim() || status.API_URL || "http://127.0.0.1:54321";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    status.SERVICE_ROLE_KEY ||
    status.SECRET_KEY ||
    "";
  if (!key) throw new Error("Missing local service role key. Start supabase and retry.");
  return {
    client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    mode: "local",
  };
}

async function main() {
  const skipFetch = process.argv.includes("--skip-fetch");
  const { client, mode } = resolveClient();
  const reports = [];

  for (const area of AREAS) {
    const started = Date.now();
    const { data: before, error: beforeError } = await client.rpc("get_search_area_coverage", {
      p_west: area.bbox.west,
      p_south: area.bbox.south,
      p_east: area.bbox.east,
      p_north: area.bbox.north,
    });
    if (beforeError) {
      reports.push({
        area: area.name,
        error: beforeError.message,
        hint: "Apply migration 20260918120000_sweden_wide_discovery.sql first.",
      });
      continue;
    }

    let ensure: Awaited<ReturnType<typeof ensureSearchAreaEvidence>> | null = null;
    if (!skipFetch) {
      ensure = await ensureSearchAreaEvidence({
        service: client,
        coverageClient: client,
        bbox: area.bbox,
      });
    }

    const { data: after } = await client.rpc("get_search_area_coverage", {
      p_west: area.bbox.west,
      p_south: area.bbox.south,
      p_east: area.bbox.east,
      p_north: area.bbox.north,
    });

    reports.push({
      area: area.name,
      mode,
      searchArea: area.bbox,
      runtimeMs: Date.now() - started,
      coverageBefore: {
        nmd: before?.nmd?.status,
        copernicus: before?.copernicus?.status,
        roadlink: before?.roadlink?.status,
        protected: before?.protectedAreas?.status,
        natura: before?.natura2000?.status,
        ei: before?.eiNetworkAreas?.status,
        nup: before?.nup?.status,
      },
      coverageAfter: after
        ? {
            nmd: after.nmd?.status,
            copernicus: after.copernicus?.status,
            roadlink: after.roadlink?.status,
          }
        : null,
      fetched: ensure?.fetched ?? [],
      reusedCache: ensure?.reusedCache ?? null,
      sources: ensure?.sources ?? [],
      messages: ensure?.messages ?? [],
      note: "Candidate count requires execute_opportunity_screening_run via the product path.",
    });
  }

  console.log(JSON.stringify({ event: "prove.sweden_wide_discovery", reports }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
