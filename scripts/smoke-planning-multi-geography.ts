/**
 * Multi-geography municipal planning smoke (Malmö / Göteborg / Örebro).
 * Malmö: supported public ArcGIS REST. Göteborg/Örebro: unavailable (UNKNOWN).
 * Uses Design Partner Cloud. Does not reset demo.
 */
import { createClient } from "@supabase/supabase-js";
import { PLANNING_SOURCE_SLUG } from "../src/lib/ingest/coverage-keys";
import { ensureSearchAreaEvidence } from "../src/lib/ingest/orchestrate";
import { planningProvidersForBbox } from "../src/lib/opportunities/planning-providers";
import { DESIGN_PARTNER_CLOUD_PROJECT_REF, runSupabase } from "./lib/ingest-target.mjs";

const GEOGRAPHIES = [
  { name: "malmo", west: 12.95, south: 55.55, east: 13.1, north: 55.65 },
  { name: "goteborg", west: 11.85, south: 57.65, east: 12.05, north: 57.78 },
  { name: "orebro", west: 15.1, south: 59.2, east: 15.3, north: 59.35 },
] as const;

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

async function smokeOne(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: any,
  geo: (typeof GEOGRAPHIES)[number],
) {
  const providers = planningProvidersForBbox({
    west: geo.west,
    south: geo.south,
    east: geo.east,
    north: geo.north,
  });
  const supported = providers.filter((p) => p.status === "supported");
  const unavailable = providers.filter((p) => p.status === "unavailable");

  const t1 = Date.now();
  const first = await ensureSearchAreaEvidence({
    service: client,
    coverageClient: client,
    bbox: { west: geo.west, south: geo.south, east: geo.east, north: geo.north },
  });
  const firstMs = Date.now() - t1;

  const t2 = Date.now();
  const second = await ensureSearchAreaEvidence({
    service: client,
    coverageClient: client,
    bbox: { west: geo.west, south: geo.south, east: geo.east, north: geo.north },
  });
  const secondMs = Date.now() - t2;

  const sources = first.sources.filter((s) => s.slug === PLANNING_SOURCE_SLUG);
  return {
    geography: geo.name,
    bbox: geo,
    providers: providers.map((p) => ({ key: p.key, status: p.status, municipality: p.municipalityName })),
    supportedCount: supported.length,
    unavailableCount: unavailable.length,
    planningStatus: first.coverage?.planning?.status ?? null,
    planningFeatures: first.coverage?.planning?.intersectingFeatures ?? null,
    firstMs,
    secondMs,
    firstPlanningActions: sources.map((s) => s.action),
    firstFetchedPlanning: first.fetched.includes(PLANNING_SOURCE_SLUG),
    secondReused: second.reusedCache,
    messages: first.messages.filter((m) => /planning|detaljplan|municipal/i.test(m)),
  };
}

async function main() {
  const keys = parseEnv(
    runSupabase(["projects", "api-keys", "--project-ref", DESIGN_PARTNER_CLOUD_PROJECT_REF, "-o", "env"]),
  );
  const client = createClient(`https://${DESIGN_PARTNER_CLOUD_PROJECT_REF}.supabase.co`, keys.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results = [];
  for (const geo of GEOGRAPHIES) {
    results.push(await smokeOne(client, geo));
  }

  console.log(JSON.stringify({ project: DESIGN_PARTNER_CLOUD_PROJECT_REF, results }, null, 2));

  const malmo = results.find((r) => r.geography === "malmo");
  const gbg = results.find((r) => r.geography === "goteborg");
  const ore = results.find((r) => r.geography === "orebro");

  if (!malmo || malmo.supportedCount < 1) {
    throw new Error("Malmö must resolve a supported planning provider");
  }
  if (!gbg || gbg.supportedCount !== 0 || gbg.unavailableCount < 1) {
    throw new Error("Göteborg must resolve unavailable (not fake evaluated coverage)");
  }
  if (!ore || ore.supportedCount !== 0 || ore.unavailableCount < 1) {
    throw new Error("Örebro must resolve unavailable (not fake evaluated coverage)");
  }
  if (malmo.planningStatus !== "covered" && malmo.planningStatus !== "partial") {
    // After first successful Malmö fetch, windows should be covered/partial.
    // If still missing, ingest failed — fail smoke.
    if (!malmo.firstFetchedPlanning && malmo.firstPlanningActions.every((a) => a === "skipped" || a === "failed")) {
      throw new Error(`Malmö planning ingest did not succeed: ${JSON.stringify(malmo.firstPlanningActions)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
