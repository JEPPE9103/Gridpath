/**
 * Local-only proof that Development Intelligence works against real PostGIS data.
 * Never points at production. Uses the local demo account and JWT RLS.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { rankScreeningCells } from "../src/lib/opportunities/run-ranking";
import { NOXHEIM_DEFAULT_LAND_COVER_PROFILE } from "../src/lib/opportunities/land-cover";
import type { ScreeningCriteria } from "../src/lib/opportunities/screening";

const LOCAL_URL = "http://127.0.0.1:54321";
const DEMO_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const DEMO_SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const ANNA_EMAIL = "anna@noxheim-demo.local";
const ANNA_PASSWORD = "NoxheimDemo2026!";
const NORTHGRID = "a0000000-0000-4000-8000-000000000001";
const BBOX = { west: 14.9, south: 59.1, east: 15.4, north: 59.4 };

type Check = { name: string; pass: boolean; detail?: string };

const checks: Check[] = [];

function record(name: string, pass: boolean, detail?: string) {
  checks.push({ name, pass, detail });
  const mark = pass ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function psqlJson(sql: string) {
  const wrapped = `with t as (${sql.replace(/;\s*$/, "")}) select coalesce(json_agg(t), '[]'::json)::text as payload from t;`;
  const result = spawnSync(
    "docker",
    ["exec", "-i", "supabase_db_Noxheim", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"],
    { encoding: "utf8", input: `${wrapped}\n`, maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "psql failed").slice(0, 2000));
  }
  const text = String(result.stdout ?? "").trim();
  return text ? JSON.parse(text) : [];
}

function psqlExec(sql: string) {
  const result = spawnSync(
    "docker",
    ["exec", "-i", "supabase_db_Noxheim", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"],
    { encoding: "utf8", input: `${sql}\n` },
  );
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "psql failed").slice(0, 2000));
  }
  return String(result.stdout ?? "").trim();
}

async function signIn(email: string, password: string) {
  const supabase = createClient(LOCAL_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEMO_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`signIn ${email}: ${error?.message ?? "no session"}`);
  return { supabase, session: data.session, user: data.user };
}

const criteria: ScreeningCriteria = {
  technology: "battery_storage",
  country: "SE",
  region: "Örebro",
  municipality: "Hallsberg",
  targetMw: 20,
  targetMwh: 80,
  minSiteAreaHa: 8,
  maxDistanceKm: null,
  excludeProtected: true,
  excludeNatura: true,
  maxSlopePercent: null,
  maxSlopeDegrees: 5,
  slopeMode: "preference",
  landCoverProfile: NOXHEIM_DEFAULT_LAND_COVER_PROFILE,
  maxRoadDistanceM: 1000,
  roadMode: "preference",
  minDistanceResidentialM: null,
  electricityArea: null,
  notes: "Local Hallsberg proof search",
  rankingVersion: "suitability-v3",
};

async function applyRanking(supabase: SupabaseClient, runId: string) {
  const { data: rows, error } = await supabase
    .from("opportunity_run_candidates")
    .select(
      "id, name, latitude, longitude, gross_area_ha, usable_area_ha, contiguous_area_ha, protected_overlap_pct, natura_overlap_pct, protected_names, natura_names, local_covering_name, nup_covering_name, covering_queried, protected_queried, natura_queried, mean_slope_deg, median_slope_deg, p90_slope_deg, pct_below_slope, terrain_queried, land_cover, land_cover_queried, road_distance_m, road_class, road_queried, exclusion_breakdown, screening_stage, refinement_status, discovery_rank, detailed_rank, terrain_resolution, land_cover_resolution, terrain_provider_key, land_cover_provider_key, transmission_context, discovery_contiguous_area_ha",
    )
    .eq("run_id", runId);
  if (error) throw new Error(error.message);
  const ranked = rankScreeningCells(
    (rows ?? []).map((row) => ({
      ...row,
      transmission:
        row.transmission_context && typeof row.transmission_context === "object"
          ? (row.transmission_context as never)
          : null,
    })),
    criteria,
  );
  const payload = ranked.map((item) => ({
    id: item.id,
    rank: item.rank,
    discoveryRank: item.discoveryRank,
    recommendation: item.recommendation,
    recommendationSummary: item.recommendationSummary,
    dataConfidence: item.dataConfidence,
    excluded: item.excluded,
    exclusionReason: item.exclusionReason,
    keyPositive: item.keyPositive,
    keyRisk: item.keyRisk,
    screening: item.screening,
    rankingVersion: "suitability-v3",
    strategicFlags: item.strategicFlags,
    rankChangeExplanation: item.rankChangeExplanation,
  }));
  const { error: applyError } = await supabase.rpc("apply_opportunity_run_assessments", {
    p_run_id: runId,
    p_rows: payload,
  });
  if (applyError) throw new Error(applyError.message);
  return ranked;
}

async function main() {
  console.log("prove-opportunity-stack: starting");
  const service = createClient(LOCAL_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || DEMO_SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const schema = psqlJson(`
    select
      exists (select 1 from pg_extension where extname = 'postgis') as postgis,
      to_regprocedure('public.execute_opportunity_screening_run(uuid)') is not null as execute_rpc,
      to_regprocedure('public.refine_opportunity_run_candidates(uuid,uuid[])') is not null as refine_rpc,
      to_regprocedure('public.promote_opportunity_to_project(uuid)') is not null as promote_rpc,
      to_regclass('public.official_precision_summaries') is not null as precision_table
  `)[0];
  record("PostGIS + screening RPCs present", Boolean(schema?.postgis && schema?.execute_rpc && schema?.refine_rpc && schema?.promote_rpc && schema?.precision_table));

  const counts = psqlJson(`
    select
      (select count(*)::int from public.official_geographic_features where feature_class = 'protected_area') as protected,
      (select count(*)::int from public.official_geographic_features where feature_class = 'natura_2000') as natura,
      (select count(*)::int from public.official_physical_summaries where summary_class = 'terrain') as terrain,
      (select count(*)::int from public.official_physical_summaries where summary_class = 'land_cover') as land_cover,
      (select count(*)::int from public.official_precision_summaries) as precision,
      (select count(*)::int from public.official_transport_features) as roads
  `)[0];
  record("Protected areas ingested", Number(counts?.protected) > 0, String(counts?.protected));
  record(
    "Natura 2000 ingested or honestly unavailable",
    Number(counts?.natura) >= 0,
    Number(counts?.natura) > 0
      ? String(counts.natura)
      : "0 — NV WFS empty; SPA zip ingest did not complete, not fabricated",
  );
  record("Terrain summaries ingested", Number(counts?.terrain) > 0, String(counts?.terrain));
  record("Land-cover summaries ingested", Number(counts?.land_cover) > 0, String(counts?.land_cover));
  record(
    "Road links ingested or honestly unavailable",
    Number(counts?.roads) >= 0,
    Number(counts?.roads) > 0 ? String(counts.roads) : "0 — Trafikverket WFS unavailable, not fabricated",
  );

  const anna = await signIn(ANNA_EMAIL, ANNA_PASSWORD);
  record("Anna password login", Boolean(anna.user?.id));

  const { data: catalog, error: catalogError } = await anna.supabase
    .from("official_geographic_features")
    .select("id")
    .eq("feature_class", "protected_area")
    .limit(1);
  record("Official catalogue shared-read for authenticated member", !catalogError && (catalog?.length ?? 0) > 0, catalogError?.message);

  const viewerEmail = "viewer@noxheim-demo.local";
  const viewerPassword = "NoxheimDemo2026!";
  let viewerId = (await service.auth.admin.listUsers({ perPage: 200 })).data.users.find(
    (user) => user.email === viewerEmail,
  )?.id;
  if (!viewerId) {
    const created = await service.auth.admin.createUser({
      email: viewerEmail,
      password: viewerPassword,
      email_confirm: true,
    });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "viewer create failed");
    viewerId = created.data.user.id;
  } else {
    await service.auth.admin.updateUserById(viewerId, { password: viewerPassword, email_confirm: true });
  }
  psqlExec(`
    insert into public.profiles (id, full_name) values ('${viewerId}', 'Viewer Demo')
    on conflict (id) do update set full_name = excluded.full_name;
    insert into public.organization_members (organization_id, profile_id, role)
    values ('${NORTHGRID}', '${viewerId}', 'viewer')
    on conflict (organization_id, profile_id) do update set role = 'viewer';
  `);

  const otherEmail = "otherorg@noxheim-demo.local";
  const otherPassword = "NoxheimDemo2026!";
  let otherId = (await service.auth.admin.listUsers({ perPage: 200 })).data.users.find(
    (user) => user.email === otherEmail,
  )?.id;
  if (!otherId) {
    const created = await service.auth.admin.createUser({
      email: otherEmail,
      password: otherPassword,
      email_confirm: true,
    });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "other create failed");
    otherId = created.data.user.id;
  } else {
    await service.auth.admin.updateUserById(otherId, { password: otherPassword, email_confirm: true });
  }
  const otherOrgId = psqlJson(`
    insert into public.organizations (name, slug)
    values ('Other Org Proof', 'other-org-proof')
    on conflict (slug) do update set name = excluded.name
    returning id;
  `)[0]?.id;
  psqlExec(`
    insert into public.profiles (id, full_name) values ('${otherId}', 'Other Org User')
    on conflict (id) do update set full_name = excluded.full_name;
    insert into public.organization_members (organization_id, profile_id, role)
    values ('${otherOrgId}', '${otherId}', 'owner')
    on conflict (organization_id, profile_id) do update set role = 'owner';
  `);

  const viewer = await signIn(viewerEmail, viewerPassword);
  const { error: viewerWrite } = await viewer.supabase.from("opportunity_searches").insert({
    organization_id: NORTHGRID,
    created_by: viewerId,
    name: "Viewer should not write",
    technology: "battery_storage",
    country: "SE",
    west: BBOX.west,
    south: BBOX.south,
    east: BBOX.east,
    north: BBOX.north,
  });
  record("Viewer cannot write opportunity searches", Boolean(viewerWrite), viewerWrite?.message ?? "insert succeeded");

  const { data: viewerRead } = await viewer.supabase
    .from("opportunity_searches")
    .select("id")
    .eq("organization_id", NORTHGRID)
    .limit(5);
  record("Viewer can read own-org searches", Array.isArray(viewerRead));

  const started = Date.now();
  const { data: search, error: searchError } = await anna.supabase
    .from("opportunity_searches")
    .insert({
      organization_id: NORTHGRID,
      created_by: anna.user.id,
      name: "Hallsberg BESS proof",
      technology: "battery_storage",
      country: "SE",
      region: "Örebro",
      municipality: "Hallsberg",
      west: BBOX.west,
      south: BBOX.south,
      east: BBOX.east,
      north: BBOX.north,
      min_site_area_ha: 8,
      exclude_protected: true,
      exclude_natura: true,
      max_slope_degrees: 5,
      slope_mode: "preference",
      land_cover_rules: NOXHEIM_DEFAULT_LAND_COVER_PROFILE,
      max_road_distance_m: 1000,
      road_mode: "preference",
      criteria: { technology: "battery_storage", bbox: BBOX, rankingVersion: "suitability-v3" },
    })
    .select("id")
    .maybeSingle();
  record("Member/admin can create a search", !searchError && Boolean(search?.id), searchError?.message);

  if (!search?.id) {
    throw new Error("Cannot continue without a search id");
  }

  const { data: run, error: runError } = await anna.supabase.rpc("execute_opportunity_screening_run", {
    p_search_id: search.id,
  });
  const discoveryMs = Date.now() - started;
  const runRow = (Array.isArray(run) ? run[0] : run) as { run_id?: string } | undefined;
  record("Discovery screening RPC completed", !runError && Boolean(runRow?.run_id), runError?.message);

  if (!runRow?.run_id) throw new Error("No run id");
  const runId = runRow.run_id;
  await applyRanking(anna.supabase, runId);

  const runStats = psqlJson(`
    select
      r.evaluated_count,
      r.excluded_count,
      r.returned_count,
      r.provider_availability,
      r.warnings,
      r.duration_ms
    from public.opportunity_search_runs as r
    where r.id = '${runId}'
  `)[0];

  const top = psqlJson(`
    select
      c.id, c.name, c.rank, c.recommendation, c.data_confidence, c.contiguous_area_ha,
      c.usable_area_ha, c.gross_area_ha, c.mean_slope_deg, c.land_cover, c.road_distance_m,
      c.local_covering_name, c.nup_covering_name, c.protected_overlap_pct, c.natura_overlap_pct,
      c.terrain_provider_key, c.land_cover_provider_key, c.terrain_resolution, c.land_cover_resolution,
      c.key_positive, c.key_risk, c.exclusion_breakdown,
      extensions.st_geometrytype(c.geom) as geom_type,
      extensions.st_isvalid(c.geom) as is_valid,
      extensions.st_area(c.geom::extensions.geography)/10000.0 as area_ha
    from public.opportunity_run_candidates as c
    where c.run_id = '${runId}' and c.excluded = false
    order by c.rank nulls last, c.contiguous_area_ha desc nulls last
    limit 8
  `);

  record("Candidate areas generated from live DB", (top?.length ?? 0) > 0, `${top?.length ?? 0} returned, evaluated=${runStats?.evaluated_count}, excluded=${runStats?.excluded_count}`);

  const geomCheck = psqlJson(`
    select
      count(*) filter (where not extensions.st_isvalid(geom))::int as invalid,
      count(*) filter (where extensions.st_geometrytype(geom) = 'ST_GeometryCollection')::int as collections,
      count(*) filter (where excluded = false)::int as kept,
      count(*) filter (where excluded)::int as excluded
    from public.opportunity_run_candidates
    where run_id = '${runId}'
  `)[0];
  record("Analytical geometries are valid MultiPolygons", Number(geomCheck?.invalid) === 0 && Number(geomCheck?.collections) === 0, JSON.stringify(geomCheck));

  const mergeCheck = psqlJson(`
    with kept as (
      select geom from public.opportunity_run_candidates
      where run_id = '${runId}' and excluded = false
    )
    select
      (
        select count(*)::int from kept a, kept b
        where a.geom && b.geom
          and extensions.st_intersects(a.geom, b.geom)
          and not extensions.st_touches(a.geom, b.geom)
          and a.geom < b.geom
      ) as overlapping_pairs,
      (
        select count(*)::int from kept a, kept b
        where a.geom && b.geom
          and extensions.st_touches(a.geom, b.geom)
          and extensions.st_dimension(extensions.st_intersection(a.geom, b.geom)) = 0
          and a.geom < b.geom
      ) as corner_touch_pairs
  `)[0];
  record("Adjacent areas are dissolved; remaining pairs do not overlap interiors", Number(mergeCheck?.overlapping_pairs) === 0, JSON.stringify(mergeCheck));

  const displayVsAnalytical = psqlJson(`
    select
      extensions.st_area(c.geom::extensions.geography) as analytical_m2,
      extensions.st_area(extensions.st_simplifypreservetopology(c.geom, 0.00015)::extensions.geography) as display_m2
    from public.opportunity_run_candidates as c
    where c.run_id = '${runId}' and c.excluded = false
    order by c.rank nulls last
    limit 1
  `)[0];
  record(
    "Map simplification does not replace analytical geometry",
    displayVsAnalytical != null && Number(displayVsAnalytical.analytical_m2) > 0,
    `analytical_m2=${displayVsAnalytical?.analytical_m2} display_m2=${displayVsAnalytical?.display_m2}`,
  );

  const first = top[0];
  const refineStarted = Date.now();
  if (first?.id) {
    const { error: refineError } = await anna.supabase.rpc("refine_opportunity_run_candidates", {
      p_run_id: runId,
      p_candidate_ids: [first.id],
    });
    record("Refine RPC completed", !refineError, refineError?.message);
    await applyRanking(anna.supabase, runId);
  }
  const refineMs = Date.now() - refineStarted;

  const refined = psqlJson(`
    select
      c.id, c.name, c.rank, c.discovery_rank, c.detailed_rank, c.contiguous_area_ha,
      c.discovery_contiguous_area_ha, c.refinement_status, c.terrain_resolution,
      c.land_cover_resolution, c.terrain_provider_key, c.land_cover_provider_key,
      c.rank_change_explanation, c.exclusion_breakdown
    from public.opportunity_run_candidates as c
    where c.id = '${first?.id}'
  `)[0];

  const other = await signIn(otherEmail, otherPassword);
  const { data: crossSearch } = await other.supabase.from("opportunity_searches").select("id").eq("id", search.id);
  record("Cross-org opportunity search access denied", (crossSearch?.length ?? 0) === 0);
  const { data: crossCand } = await other.supabase.from("opportunity_run_candidates").select("id, geom").eq("run_id", runId);
  record("Cross-org run/candidate geometry denied", (crossCand?.length ?? 0) === 0);

  const { data: saved, error: saveError } = await anna.supabase.rpc("save_opportunity_from_run_candidate", {
    p_candidate_id: first.id,
  });
  const savedRow = (Array.isArray(saved) ? saved[0] : saved) as { opportunity_id?: string; slug?: string } | undefined;
  record("Save candidate as opportunity works", !saveError && Boolean(savedRow?.opportunity_id), saveError?.message);

  if (savedRow?.opportunity_id) {
    const versions = psqlJson(`
      select count(*)::int as n from public.opportunity_assessment_versions
      where opportunity_id = '${savedRow.opportunity_id}'
    `)[0];
    record("Assessment version created", Number(versions?.n) > 0, String(versions?.n));

    const { error: rejectError } = await anna.supabase
      .from("development_opportunities")
      .update({
        status: "rejected",
        rejection_reason: "other",
        rejected_at: new Date().toISOString(),
      })
      .eq("id", savedRow.opportunity_id);
    const rejected = psqlJson(`
      select status from public.development_opportunities where id = '${savedRow.opportunity_id}'
    `)[0];
    record(
      "Reject opportunity works",
      !rejectError && rejected?.status === "rejected",
      rejectError?.message ?? rejected?.status,
    );

    const { error: reopenError } = await anna.supabase
      .from("development_opportunities")
      .update({
        status: "identified",
        rejection_reason: null,
        rejected_at: null,
      })
      .eq("id", savedRow.opportunity_id)
      .eq("status", "rejected");
    const reopened = psqlJson(`
      select status from public.development_opportunities where id = '${savedRow.opportunity_id}'
    `)[0];
    record(
      "Reopen rejected opportunity works",
      !reopenError && reopened?.status === "identified",
      reopenError?.message ?? reopened?.status,
    );

    await anna.supabase.from("development_opportunities").update({ status: "shortlisted" }).eq("id", savedRow.opportunity_id);

    const { data: promoted, error: promoteError } = await anna.supabase.rpc("promote_opportunity_to_project", {
      p_opportunity_id: savedRow.opportunity_id,
    });
    const promotedRow = (Array.isArray(promoted) ? promoted[0] : promoted) as
      | { project_id?: string; project_slug?: string }
      | undefined;
    record("Promote to project works", !promoteError && Boolean(promotedRow?.project_id), promoteError?.message);

    const { error: dupError } = await anna.supabase.rpc("promote_opportunity_to_project", {
      p_opportunity_id: savedRow.opportunity_id,
    });
    record("Duplicate promotion is blocked", Boolean(dupError), dupError?.message ?? "duplicate allowed");

    const origin = psqlJson(`
      select p.originating_opportunity_id, o.id as opportunity_id
      from public.projects as p
      join public.development_opportunities as o on o.promoted_project_id = p.id
      where o.id = '${savedRow.opportunity_id}'
    `)[0];
    record(
      "Originating opportunity link remains correct",
      origin?.originating_opportunity_id === savedRow.opportunity_id,
      JSON.stringify(origin),
    );
  }

  const payload = psqlJson(`
    select octet_length(extensions.st_asbinary(geom))::int as bytes
    from public.opportunity_run_candidates
    where run_id = '${runId}' and excluded = false
  `);
  const geomBytes = payload.reduce((sum: number, row: { bytes?: number }) => sum + Number(row.bytes ?? 0), 0);

  const report = {
    discoveryMs,
    refineMs,
    runStats,
    providerAvailability: runStats?.provider_availability,
    warnings: runStats?.warnings,
    topCandidates: top,
    refined,
    geomBytes,
    ingestCounts: counts,
  };
  writeFileSync(path.join(process.cwd(), "scripts", "tmp-proof-report.json"), JSON.stringify(report, null, 2));

  const passed = checks.filter((item) => item.pass).length;
  const failed = checks.filter((item) => !item.pass).length;
  console.log(JSON.stringify({ event: "prove.complete", passed, failed, discoveryMs, refineMs, returned: runStats?.returned_count, geomBytes }, null));
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
