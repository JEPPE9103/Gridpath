/**
 * Smoke: NMD via NOXHEIM_NMD2023_URL (HTTP range/window).
 * Uses a small northern bbox that is usually uncovered so first run must fetch
 * from the COG URL; second run must reuse cache. Does not touch demo (Örebro).
 */
import { createClient } from "@supabase/supabase-js";
import { nmdWindows } from "../src/lib/ingest/coverage-keys";
import { ensureSearchAreaEvidence } from "../src/lib/ingest/orchestrate";
import { resolveNmd2023Source } from "../src/lib/ingest/nmd";
import { finishIngestWindow } from "../src/lib/ingest/windows";
import { DESIGN_PARTNER_CLOUD_PROJECT_REF, runSupabase } from "./lib/ingest-target.mjs";

/** Small Kiruna-area patch — typically missing in Design Partner cache. */
const BBOX = { west: 18.05, south: 65.3, east: 18.15, north: 65.4 };

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

async function main() {
  const source = resolveNmd2023Source();
  if (!source || source.kind !== "url") {
    throw new Error("Set NOXHEIM_NMD2023_URL to an http(s) COG before this smoke.");
  }
  console.log(JSON.stringify({ event: "smoke.nmd_url.env", sourceKind: source.kind, host: new URL(source.url).hostname }));

  const keys = parseEnv(
    runSupabase(["projects", "api-keys", "--project-ref", DESIGN_PARTNER_CLOUD_PROJECT_REF, "-o", "env"]),
  );
  const client = createClient(`https://${DESIGN_PARTNER_CLOUD_PROJECT_REF}.supabase.co`, keys.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const window of nmdWindows(BBOX)) {
    await finishIngestWindow(client, window.sourceSlug, window.coverageKey, "missing");
  }

  const { data: before } = await client.rpc("get_search_area_coverage", {
    p_west: BBOX.west,
    p_south: BBOX.south,
    p_east: BBOX.east,
    p_north: BBOX.north,
  });

  const t1 = Date.now();
  const first = await ensureSearchAreaEvidence({ service: client, coverageClient: client, bbox: BBOX });
  const firstMs = Date.now() - t1;

  const t2 = Date.now();
  const second = await ensureSearchAreaEvidence({ service: client, coverageClient: client, bbox: BBOX });
  const secondMs = Date.now() - t2;

  const { data: after } = await client.rpc("get_search_area_coverage", {
    p_west: BBOX.west,
    p_south: BBOX.south,
    p_east: BBOX.east,
    p_north: BBOX.north,
  });

  const payload = {
    event: "smoke.nmd_url.product_path",
    bbox: BBOX,
    beforeNmd: before?.nmd?.status,
    beforeCount: before?.nmd?.intersectingSummaries,
    afterNmd: after?.nmd?.status,
    afterCount: after?.nmd?.intersectingSummaries,
    firstMs,
    secondMs,
    firstFetched: first.fetched,
    firstSources: first.sources.filter((s) => s.slug === "nv-nmd-2023"),
    firstMessages: first.messages,
    secondReused: second.reusedCache,
    secondSources: second.sources.filter((s) => s.slug === "nv-nmd-2023"),
  };
  console.log(JSON.stringify(payload, null, 2));

  if (before?.nmd?.status === "covered" && !first.fetched.includes("nv-nmd-2023")) {
    console.warn("bbox already covered — cache path only; window smoke remains the URL proof");
  } else if (!first.fetched.includes("nv-nmd-2023")) {
    throw new Error("Expected cold NMD fetch from NOXHEIM_NMD2023_URL");
  } else if (after?.nmd?.status !== "covered") {
    throw new Error(`Expected covered after fetch, got ${after?.nmd?.status}`);
  } else if (!second.reusedCache) {
    throw new Error("Expected second run to reuse cache");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
