import { createClient } from "@supabase/supabase-js";
import {
  fetchNominatimSwedenPlaces,
  mergeSwedenPlaceResults,
  parseAdministrativePlaces,
} from "../src/lib/places/sweden";
import { DESIGN_PARTNER_CLOUD_PROJECT_REF, runSupabase } from "./lib/ingest-target.mjs";

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
  const keys = parseEnv(
    runSupabase(["projects", "api-keys", "--project-ref", DESIGN_PARTNER_CLOUD_PROJECT_REF, "-o", "env"]),
  );
  const client = createClient(`https://${DESIGN_PARTNER_CLOUD_PROJECT_REF}.supabase.co`, keys.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await client.rpc("search_swedish_administrative_places", { p_query: "Malmö" });
  const merged = mergeSwedenPlaceResults(parseAdministrativePlaces(data), await fetchNominatimSwedenPlaces("Malmö"));
  console.log(
    JSON.stringify(
      {
        event: "smoke.place_search",
        count: merged.length,
        labels: merged.map((item) => item.label),
        kinds: merged.map((item) => item.kind),
        swedenOnly: merged.every((item) => item.bbox.west >= 10.5 && item.bbox.east <= 24.5),
        firstBbox: merged[0]?.bbox ?? null,
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
