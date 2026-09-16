/**
 * Multi-geography EBH contamination product-path smoke (Örebro / Malmö / Göteborg).
 * Uses Design Partner Cloud. Does not reset demo.
 */
import { createClient } from "@supabase/supabase-js";
import { CONTAMINATION_SOURCE_SLUG } from "../src/lib/ingest/coverage-keys";
import { ensureSearchAreaEvidence } from "../src/lib/ingest/orchestrate";
import { DESIGN_PARTNER_CLOUD_PROJECT_REF, runSupabase } from "./lib/ingest-target.mjs";

const GEOGRAPHIES = [
  { name: "orebro", west: 15.1, south: 59.2, east: 15.3, north: 59.35 },
  { name: "malmo", west: 12.95, south: 55.55, east: 13.1, north: 55.65 },
  { name: "goteborg", west: 11.85, south: 57.65, east: 12.05, north: 57.78 },
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

  const sources = first.sources.filter((s) => s.slug === CONTAMINATION_SOURCE_SLUG);
  return {
    geography: geo.name,
    bbox: geo,
    contaminationStatus: first.coverage?.contamination?.status ?? null,
    contaminationFeatures: first.coverage?.contamination?.intersectingFeatures ?? null,
    firstMs,
    secondMs,
    firstContaminationActions: sources.map((s) => s.action),
    firstFetchedContamination: first.fetched.includes(CONTAMINATION_SOURCE_SLUG),
    secondReused: second.reusedCache,
    messages: first.messages.filter((m) => /environmental-history|contamination|ebh/i.test(m)),
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
  console.log(JSON.stringify({ event: "smoke.contamination.multi_geography", results }, null, 2));
  for (const row of results) {
    if (row.contaminationStatus !== "covered" && row.contaminationStatus !== "partial") {
      throw new Error(
        `${row.geography}: expected contamination covered/partial, got ${row.contaminationStatus}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
