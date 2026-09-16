/**
 * Prove Malmö planning Candidate contrast from Design Partner Cloud (service role).
 */
import { createClient } from "@supabase/supabase-js";
import { DESIGN_PARTNER_CLOUD_PROJECT_REF, runSupabase } from "./lib/ingest-target.mjs";

function parseEnv(text) {
  const values = {};
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

const keys = parseEnv(
  runSupabase(["projects", "api-keys", "--project-ref", DESIGN_PARTNER_CLOUD_PROJECT_REF, "-o", "env"]),
);
const client = createClient(`https://${DESIGN_PARTNER_CLOUD_PROJECT_REF}.supabase.co`, keys.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: candidates, error: cErr } = await client
  .from("opportunity_run_candidates")
  .select(
    `
    id,
    name,
    rank,
    usable_area_ha,
    latitude,
    longitude,
    planning_queried,
    planning_intersecting_count,
    planning_overlap_pct,
    planning_nearest_m,
    planning_plan_ids,
    planning_plan_names,
    planning_plan_statuses,
    planning_municipality,
    planning_provider_key,
    run_id,
    created_at
  `,
  )
  .eq("planning_queried", true)
  .order("created_at", { ascending: false })
  .limit(80);

if (cErr) {
  console.log(JSON.stringify({ label: "candidates_error", error: cErr.message }));
  process.exit(1);
}

const inMalmo = (c) =>
  c.planning_municipality === "Malmö" ||
  (typeof c.planning_provider_key === "string" && c.planning_provider_key.includes("malmo")) ||
  (c.longitude != null &&
    c.latitude != null &&
    c.longitude > 12.7 &&
    c.longitude < 13.3 &&
    c.latitude > 55.4 &&
    c.latitude < 55.8);

const scoped = (candidates ?? []).filter(inMalmo);
const pool = scoped.length > 0 ? scoped : candidates ?? [];

const evaluatedOutside = pool.filter((c) => (c.planning_intersecting_count ?? 0) === 0);
const intersecting = pool.filter((c) => (c.planning_intersecting_count ?? 0) > 0);
const multi = intersecting.filter((c) => (c.planning_intersecting_count ?? 0) > 1);

function summarize(c) {
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    rank: c.rank,
    areaHa: c.usable_area_ha,
    municipality: c.planning_municipality,
    provider: c.planning_provider_key,
    intersectingCount: c.planning_intersecting_count,
    overlapPct: c.planning_overlap_pct,
    nearestM: c.planning_nearest_m,
    planIds: c.planning_plan_ids,
    planNames: c.planning_plan_names,
    planStatuses: c.planning_plan_statuses,
    runId: c.run_id,
  };
}

console.log(
  JSON.stringify(
    {
      label: "malmo_planning_contrast",
      totalPlanningQueried: candidates?.length ?? 0,
      malmoScoped: scoped.length,
      outsideCount: evaluatedOutside.length,
      intersectingCount: intersecting.length,
      multiCount: multi.length,
      candidateA_outside: summarize(evaluatedOutside[0]),
      candidateB_intersecting: summarize(intersecting[0]),
      candidateC_multi: summarize(multi[0]),
    },
    null,
    2,
  ),
);
