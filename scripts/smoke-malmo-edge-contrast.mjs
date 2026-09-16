/**
 * Second Malmö AOI — outer municipality edge to find evaluated+no-intersection Candidates.
 */
import { createClient } from "@supabase/supabase-js";
import { ensureSearchAreaEvidence } from "../src/lib/ingest/orchestrate";
import { DESIGN_PARTNER_CLOUD_PROJECT_REF, runSupabase } from "./lib/ingest-target.mjs";

// Outer Malmö / periphery — denser downtown was 100% plan intersection.
const MALMO_EDGE = { west: 13.02, south: 55.58, east: 13.14, north: 55.68 };
const DEMO_ORG = "ea5096a9-8da3-42e6-9dbd-64097414cb03";

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

async function main() {
  const keys = parseEnv(
    runSupabase(["projects", "api-keys", "--project-ref", DESIGN_PARTNER_CLOUD_PROJECT_REF, "-o", "env"]),
  );
  const url = `https://${DESIGN_PARTNER_CLOUD_PROJECT_REF}.supabase.co`;
  const service = createClient(url, keys.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonKey = keys.SUPABASE_ANON_KEY || keys.SUPABASE_PUBLISHABLE_KEY;

  const ensureStarted = Date.now();
  const ensure = await ensureSearchAreaEvidence({ service, coverageClient: service, bbox: MALMO_EDGE });
  const ensureMs = Date.now() - ensureStarted;

  const { data: membership } = await service
    .from("organization_members")
    .select("profile_id")
    .eq("organization_id", DEMO_ORG)
    .in("role", ["owner", "admin", "member"])
    .limit(1)
    .maybeSingle();
  const { data: authUser } = await service.auth.admin.getUserById(membership.profile_id);
  const { data: linkData } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: authUser.user.email,
  });
  const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: sessionData } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties.hashed_token,
  });
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: search, error: searchError } = await userClient
    .from("opportunity_searches")
    .insert({
      organization_id: DEMO_ORG,
      created_by: membership.profile_id,
      name: `Malmö edge planning contrast ${new Date().toISOString().slice(0, 16)}`,
      technology: "battery_storage",
      country: "SE",
      region: "Skåne",
      municipality: "Malmö",
      west: MALMO_EDGE.west,
      south: MALMO_EDGE.south,
      east: MALMO_EDGE.east,
      north: MALMO_EDGE.north,
      cell_size_m: 500,
      min_site_area_ha: 2,
      target_site_area_ha: 5,
      max_candidate_area_ha: 20,
      max_returned_candidates: 25,
      exclude_protected: true,
      exclude_natura: true,
      max_slope_degrees: 8,
      slope_mode: "preference",
      max_road_distance_m: 2000,
      road_mode: "preference",
      land_cover_rules: {
        water: "excluded",
        wetland: "excluded",
        forest: "deprioritised",
        agriculture: "preferred",
        open: "preferred",
        developed: "deprioritised",
        unclassified: "neutral",
      },
      criteria: { technology: "battery_storage", bbox: MALMO_EDGE, rankingVersion: "suitability-v4" },
    })
    .select("id")
    .maybeSingle();
  if (searchError || !search?.id) throw new Error(searchError?.message ?? "search failed");

  const screenStarted = Date.now();
  const { data: run, error: runError } = await userClient.rpc("execute_opportunity_screening_run", {
    p_search_id: search.id,
  });
  if (runError) throw new Error(runError.message);
  const runRow = (Array.isArray(run) ? run[0] : run);
  await userClient.rpc("segment_opportunity_run_into_sites", { p_run_id: runRow.run_id });
  for (const rpc of [
    "apply_flood_overlap_to_run",
    "apply_ground_composition_to_run",
    "apply_contamination_to_run",
    "apply_planning_to_run",
  ]) {
    const { error } = await userClient.rpc(rpc, { p_run_id: runRow.run_id });
    if (error) throw new Error(`${rpc}: ${error.message}`);
  }

  const { data: sample } = await userClient
    .from("opportunity_run_candidates")
    .select(
      "id, name, usable_area_ha, planning_queried, planning_intersecting_count, planning_overlap_pct, planning_nearest_m, planning_plan_ids, planning_plan_names, planning_plan_statuses, planning_municipality",
    )
    .eq("run_id", runRow.run_id)
    .eq("candidate_kind", "site");

  const outside = (sample ?? []).filter((c) => c.planning_queried && (c.planning_intersecting_count ?? 0) === 0);
  const intersecting = (sample ?? []).filter((c) => (c.planning_intersecting_count ?? 0) > 0);

  console.log(
    JSON.stringify(
      {
        event: "smoke.malmo.edge.contrast",
        searchId: search.id,
        runId: runRow.run_id,
        ensureMs,
        screenMs: Date.now() - screenStarted,
        ensurePlanning: ensure.sources.filter((s) => s.slug.includes("plan") || s.slug.includes("malmo")),
        candidateCount: sample?.length ?? 0,
        outsideCount: outside.length,
        intersectingCount: intersecting.length,
        candidateA_outside: outside[0] ?? null,
        candidateB_intersecting: intersecting[0] ?? null,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
