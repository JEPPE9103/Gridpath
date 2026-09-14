/**
 * First vs second ensureSearchAreaEvidence timing for one virgin bbox.
 * Local Supabase only.
 */
import { createClient } from "@supabase/supabase-js";
import { ensureSearchAreaEvidence } from "../src/lib/ingest/orchestrate";
import { runSupabase } from "./lib/ingest-target.mjs";

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
  const status = parseEnv(runSupabase(["status", "-o", "env"]));
  const client = createClient(status.API_URL, status.SERVICE_ROLE_KEY || status.SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const bbox = { west: 16.45, south: 59.55, east: 16.55, north: 59.62 };

  const t1 = Date.now();
  const first = await ensureSearchAreaEvidence({ service: client, coverageClient: client, bbox });
  const firstMs = Date.now() - t1;

  const t2 = Date.now();
  const second = await ensureSearchAreaEvidence({ service: client, coverageClient: client, bbox });
  const secondMs = Date.now() - t2;

  console.log(
    JSON.stringify(
      {
        area: "Västerås probe",
        bbox,
        firstMs,
        secondMs,
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
