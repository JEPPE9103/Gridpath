/**
 * Full Malmö screening via the same RPCs the product uses after ensureCoverage.
 * Uses Design Partner Cloud + demo org. Does not seed Candidates by hand.
 */
import { createClient } from "@supabase/supabase-js";
import { ensureSearchAreaEvidence } from "../src/lib/ingest/orchestrate";
import { DESIGN_PARTNER_CLOUD_PROJECT_REF, runSupabase } from "./lib/ingest-target.mjs";

const MALMO = { west: 12.95, south: 55.55, east: 13.1, north: 55.65 };
const DEMO_ORG = "ea5096a9-8da3-42e6-9dbd-64097414cb03";

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
  const url = `https://${DESIGN_PARTNER_CLOUD_PROJECT_REF}.supabase.co`;
  const service = createClient(url, keys.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(url, keys.SUPABASE_ANON_KEY || keys.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const started = Date.now();
  const ensure = await ensureSearchAreaEvidence({ service, coverageClient: service, bbox: MALMO });

  const { data: membership, error: memberError } = await service
    .from("organization_members")
    .select("profile_id, role")
    .eq("organization_id", DEMO_ORG)
    .in("role", ["owner", "admin", "member"])
    .limit(1)
    .maybeSingle();
  if (memberError || !membership?.profile_id) throw new Error(memberError?.message ?? "No demo member");

  const { data: authUser, error: authUserError } = await service.auth.admin.getUserById(membership.profile_id);
  if (authUserError || !authUser.user?.email) {
    throw new Error(authUserError?.message ?? "No demo auth email");
  }
  const profile = { id: membership.profile_id, email: authUser.user.email };

  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: profile.email,
  });
  if (linkError) throw new Error(linkError.message);
  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) throw new Error("No magic-link token for demo member");

  const { data: sessionData, error: otpError } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: tokenHash,
  });
  if (otpError || !sessionData.session) throw new Error(otpError?.message ?? "Could not create demo session");

  const userClient = createClient(url, keys.SUPABASE_ANON_KEY || keys.SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${sessionData.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: search, error: searchError } = await userClient
    .from("opportunity_searches")
    .insert({
      organization_id: DEMO_ORG,
      created_by: profile.id,
      name: `Malmö smoke ${new Date().toISOString().slice(0, 16)}`,
      technology: "battery_storage",
      country: "SE",
      region: "Skåne",
      municipality: "Malmö",
      west: MALMO.west,
      south: MALMO.south,
      east: MALMO.east,
      north: MALMO.north,
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
      criteria: { technology: "battery_storage", bbox: MALMO, rankingVersion: "suitability-v4" },
      ingest_progress: {
        stage: "screening",
        messages: ensure.messages,
        sources: ensure.sources,
        updatedAt: new Date().toISOString(),
      },
    })
    .select("id")
    .maybeSingle();

  if (searchError || !search?.id) throw new Error(searchError?.message ?? "search insert failed");

  const { data: run, error: runError } = await userClient.rpc("execute_opportunity_screening_run", {
    p_search_id: search.id,
  });
  if (runError) throw new Error(runError.message);
  const runRow = (Array.isArray(run) ? run[0] : run) as {
    run_id?: string;
    warnings?: unknown;
    returned_count?: number;
  };
  if (!runRow?.run_id) throw new Error("no run_id");

  const { error: segmentError } = await userClient.rpc("segment_opportunity_run_into_sites", {
    p_run_id: runRow.run_id,
  });
  if (segmentError) throw new Error(segmentError.message);

  for (const rpc of [
    "apply_flood_overlap_to_run",
    "apply_ground_composition_to_run",
    "apply_contamination_to_run",
    "apply_planning_to_run",
  ] as const) {
    const { error } = await userClient.rpc(rpc, { p_run_id: runRow.run_id });
    if (error) throw new Error(`${rpc}: ${error.message}`);
  }

  const { count } = await userClient
    .from("opportunity_run_candidates")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runRow.run_id)
    .eq("candidate_kind", "site");

  const { data: sample } = await userClient
    .from("opportunity_run_candidates")
    .select(
      "id, name, usable_area_ha, planning_queried, planning_intersecting_count, planning_overlap_pct, planning_nearest_m, planning_plan_ids, planning_plan_names, planning_plan_statuses, planning_municipality, planning_provider_key, land_cover_queried, terrain_queried, road_queried, protected_queried, mean_slope_deg, road_distance_m",
    )
    .eq("run_id", runRow.run_id)
    .eq("candidate_kind", "site")
    .order("rank", { ascending: true, nullsFirst: false })
    .limit(25);

  const outside = (sample ?? []).filter((c) => c.planning_queried && (c.planning_intersecting_count ?? 0) === 0);
  const intersecting = (sample ?? []).filter((c) => (c.planning_intersecting_count ?? 0) > 0);
  const multi = intersecting.filter((c) => (c.planning_intersecting_count ?? 0) > 1);

  const { data: geojson } = await userClient.rpc("get_opportunity_run_geojson", { p_run_id: runRow.run_id });
  const featureCount = Array.isArray((geojson as { features?: unknown[] } | null)?.features)
    ? ((geojson as { features: unknown[] }).features.length)
    : null;

  console.log(
    JSON.stringify(
      {
        event: "smoke.malmo.screening",
        searchId: search.id,
        runId: runRow.run_id,
        bbox: MALMO,
        runtimeMs: Date.now() - started,
        candidateCount: count ?? 0,
        warnings: runRow.warnings ?? [],
        ensureMessages: ensure.messages,
        ensureSources: ensure.sources,
        planningContrast: {
          outsideCount: outside.length,
          intersectingCount: intersecting.length,
          multiCount: multi.length,
          candidateA_outside: outside[0] ?? null,
          candidateB_intersecting: intersecting[0] ?? null,
          candidateC_multi: multi[0] ?? null,
        },
        sample: (sample ?? []).slice(0, 5),
        runGeojsonFeatureCount: featureCount,
        note: "GeoJSON is run candidates/zones only — not nationwide RoadLink/NMD. Planning applied via product RPC chain.",
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
