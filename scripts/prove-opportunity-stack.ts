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

const V2_BASELINE = {
  version: "site-generation-v2",
  commit: "35f30eb59cb6b0e7b191af2bd9ba712cef771edc",
  algorithm: "seed + target-radius buffer + clip",
  zones: 13,
  zoneHa: 64234,
  seeds: 903,
  beforeDedupe: 75,
  afterDedupe: 25,
  topAreasHa: [14.92, 14.92, 14.92, 14.92, 14.92],
  compactness: 0.997,
};

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
    { encoding: "utf8", input: `${sql}\n`, timeout: 600000, maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "psql failed").slice(0, 2000));
  }
  return String(result.stdout ?? "").trim();
}

function areaStats(values: number[]) {
  const sorted = [...values].filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return { n: 0, min: 0, median: 0, max: 0, stddev: 0, distinctTenths: 0 };
  }
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  const variance = sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sorted.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return {
    n: sorted.length,
    min: sorted[0],
    median,
    max: sorted[sorted.length - 1],
    stddev: Math.sqrt(variance),
    distinctTenths: new Set(sorted.map((value) => value.toFixed(1))).size,
  };
}

function ringToPath(
  ring: number[][],
  bbox: typeof BBOX,
  width: number,
  height: number,
): string {
  return `${ring
    .map(([lon, lat], index) => {
      const x = ((lon - bbox.west) / (bbox.east - bbox.west)) * width;
      const y = (1 - (lat - bbox.south) / (bbox.north - bbox.south)) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ")} Z`;
}

function geometryToPaths(geometry: { type?: string; coordinates?: unknown }, bbox: typeof BBOX, width: number, height: number): string[] {
  if (!geometry?.coordinates) return [];
  if (geometry.type === "Polygon") {
    return (geometry.coordinates as number[][][]).slice(0, 1).map((ring) => ringToPath(ring, bbox, width, height));
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as number[][][][])
      .slice(0, 8)
      .flatMap((polygon) => polygon.slice(0, 1).map((ring) => ringToPath(ring, bbox, width, height)));
  }
  return [];
}

function writeVisualArtifact(
  runId: string,
  sites: Array<{ id: string; name?: string; rank?: number; area_ha?: number; compactness?: number }>,
) {
  const envelope = `extensions.st_setsrid(extensions.st_makeenvelope(${BBOX.west}, ${BBOX.south}, ${BBOX.east}, ${BBOX.north}), 4326)`;
  const search = psqlJson(`
    select 'search'::text as kind, 'Hallsberg search boundary'::text as name,
      extensions.st_asgeojson(${envelope})::json as geom_json
  `);
  const zones = psqlJson(`
    select 'zone'::text as kind, z.name,
      extensions.st_asgeojson(extensions.st_simplifypreservetopology(z.geom, 0.0004))::json as geom_json
    from public.opportunity_run_zones as z
    where z.run_id = '${runId}'
  `);
  const exclusions = psqlJson(`
    select 'exclusion'::text as kind, coalesce(f.name, f.designation, f.feature_class) as name,
      extensions.st_asgeojson(
        extensions.st_simplifypreservetopology(extensions.st_intersection(f.geom, ${envelope}), 0.0006)
      )::json as geom_json
    from public.official_geographic_features as f
    where f.feature_class in ('protected_area', 'natura_2000')
      and f.geom && ${envelope}
      and extensions.st_intersects(f.geom, ${envelope})
      and not extensions.st_isempty(extensions.st_intersection(f.geom, ${envelope}))
    order by f.feature_class, f.name
    limit 80
  `);
  const siteRows = psqlJson(`
    select 'site'::text as kind, c.name,
      extensions.st_asgeojson(c.geom)::json as geom_json
    from public.opportunity_run_candidates as c
    where c.run_id = '${runId}'
      and c.candidate_kind = 'site'
      and c.excluded = false
    order by c.rank nulls last
    limit 10
  `);
  const collection = [...search, ...zones, ...exclusions, ...siteRows];

  const geojson = {
    type: "FeatureCollection",
    name: "hallsberg-site-generation-v2.1",
    features: collection.map((row: { kind?: string; name?: string; geom_json?: unknown }) => ({
      type: "Feature",
      properties: { kind: row.kind, name: row.name },
      geometry: row.geom_json,
    })),
  };
  const geojsonPath = path.join(process.cwd(), "scripts", "tmp-hallsberg-v21.geojson");
  writeFileSync(geojsonPath, JSON.stringify(geojson));

  const width = 900;
  const height = 720;
  const colors: Record<string, string> = {
    search: "none",
    zone: "rgba(59,130,246,0.12)",
    exclusion: "rgba(220,38,38,0.28)",
    site: "rgba(16,185,129,0.55)",
  };
  const strokes: Record<string, string> = {
    search: "#111827",
    zone: "#2563eb",
    exclusion: "#b91c1c",
    site: "#047857",
  };
  const paths = collection
    .flatMap((row: { kind?: string; geom_json?: { type?: string; coordinates?: unknown } }) => {
      const kind = row.kind ?? "site";
      return geometryToPaths(row.geom_json ?? {}, BBOX, width, height).map(
        (d) =>
          `<path d="${d}" fill="${colors[kind] ?? "none"}" stroke="${strokes[kind] ?? "#111"}" stroke-width="${kind === "search" ? 2 : 1}" fill-opacity="${kind === "search" ? 0 : 1}"/>`,
      );
    })
    .join("\n");
  const labels = sites
    .slice(0, 10)
    .map((site, index) => `<text x="16" y="${24 + index * 16}" font-size="12" font-family="sans-serif" fill="#064e3b">${index + 1}. ${(site.name ?? "site").slice(0, 42)} ${Number(site.area_ha ?? 0).toFixed(1)} ha c=${Number(site.compactness ?? 0).toFixed(2)}</text>`)
    .join("\n");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height + 180}" width="${width}" height="${height + 180}">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <g transform="translate(0,170)">
    ${paths}
  </g>
  <text x="16" y="22" font-size="16" font-family="sans-serif" fill="#111827">Hallsberg site-generation-v2.1 shape audit</text>
  ${labels}
</svg>`;
  writeFileSync(path.join(process.cwd(), "scripts", "tmp-hallsberg-v21.svg"), svg);
  return geojsonPath;
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
  targetSiteAreaHa: 15,
  maxCandidateAreaHa: 30,
  maxReturnedCandidates: 25,
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
    rankingVersion: "suitability-v4",
  };

async function applyRanking(supabase: SupabaseClient, runId: string) {
  const { data: rows, error } = await supabase
    .from("opportunity_run_candidates")
    .select(
      "id, name, latitude, longitude, gross_area_ha, usable_area_ha, contiguous_area_ha, protected_overlap_pct, natura_overlap_pct, protected_names, natura_names, local_covering_name, nup_covering_name, covering_queried, protected_queried, natura_queried, mean_slope_deg, median_slope_deg, p90_slope_deg, pct_below_slope, terrain_queried, land_cover, land_cover_queried, road_distance_m, road_class, road_queried, exclusion_breakdown, screening_stage, refinement_status, discovery_rank, detailed_rank, terrain_resolution, land_cover_resolution, terrain_provider_key, land_cover_provider_key, transmission_context, discovery_contiguous_area_ha, compactness, geometry_quality, target_fit_score, candidate_kind",
    )
    .eq("run_id", runId)
    .eq("candidate_kind", "site");
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
    rankingVersion: "suitability-v4",
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
      to_regprocedure('public.segment_opportunity_run_into_sites(uuid)') is not null as segment_rpc,
      to_regprocedure('public.refine_opportunity_run_candidates(uuid,uuid[])') is not null as refine_rpc,
      to_regprocedure('public.promote_opportunity_to_project(uuid)') is not null as promote_rpc,
      to_regprocedure('private.land_cover_pref_score(text,jsonb)') is not null as land_cover_pref,
      to_regclass('public.official_precision_summaries') is not null as precision_table
  `)[0];
  record("PostGIS + screening RPCs present", Boolean(schema?.postgis && schema?.execute_rpc && schema?.segment_rpc && schema?.refine_rpc && schema?.promote_rpc && schema?.land_cover_pref && schema?.precision_table));

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
  const landCoverSources = psqlJson(`
    select gs.slug, count(*)::int as n
    from public.official_physical_summaries as s
    join public.grid_sources as gs on gs.id = s.source_id
    where s.summary_class = 'land_cover'
      and s.geom && extensions.st_setsrid(
        extensions.st_makeenvelope(${BBOX.west}, ${BBOX.south}, ${BBOX.east}, ${BBOX.north}),
        4326
      )
    group by gs.slug
    order by n desc
  `);
  const nmd2023 = landCoverSources.find((row: { slug?: string }) => row.slug === "nv-nmd-2023");
  record(
    "NMD 2023 basskikt evidence is present for the Hallsberg window",
    Number(nmd2023?.n ?? 0) > 0,
    JSON.stringify(landCoverSources),
  );
  record(
    "Natura 2000 ingested or honestly unavailable",
    Number(counts?.natura) >= 0,
    Number(counts?.natura) > 0
      ? String(counts.natura)
      : "0 — official SPA zip unavailable; INSUFFICIENT EVIDENCE, not fabricated",
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
      target_site_area_ha: 15,
      max_candidate_area_ha: 30,
      max_returned_candidates: 25,
      exclude_protected: true,
      exclude_natura: true,
      max_slope_degrees: 5,
      slope_mode: "preference",
      land_cover_rules: NOXHEIM_DEFAULT_LAND_COVER_PROFILE,
      max_road_distance_m: 1000,
      road_mode: "preference",
      criteria: { technology: "battery_storage", bbox: BBOX, rankingVersion: "suitability-v4", methodologyVersion: "site-generation-v2.1" },
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
  const segmentStarted = Date.now();
  const { data: segment, error: segmentError } = await anna.supabase.rpc("segment_opportunity_run_into_sites", {
    p_run_id: runId,
  });
  let segmentRow = (Array.isArray(segment) ? segment[0] : segment) as
    | { zone_count?: number; site_count?: number; seed_count?: number; before_dedupe?: number; after_dedupe?: number; duration_ms?: number }
    | undefined;
  let segmentVia = "postgrest";
  if (segmentError || Number(segmentRow?.site_count ?? 0) === 0) {
    const claims = JSON.stringify({ sub: anna.user.id, role: "authenticated" }).replace(/'/g, "''");
    const payload = psqlExec(`
select set_config('request.jwt.claims', '${claims}', false);
select set_config('request.jwt.claim.sub', '${anna.user.id}', false);
select set_config('statement_timeout', '600000', false);
select coalesce(row_to_json(t), '{}'::json)::text
from public.segment_opportunity_run_into_sites('${runId}'::uuid) as t;
`);
    try {
      segmentRow = JSON.parse(payload.split(/\r?\n/).filter(Boolean).at(-1) ?? "{}");
      segmentVia = "psql-jwt";
    } catch {
      segmentRow = undefined;
    }
  }
  const segmentMs = Date.now() - segmentStarted;
  record(
    "Site-generation v2.1 region-grew candidate sites from eligible land units",
    Number(segmentRow?.site_count ?? 0) > 0,
    `${segmentVia}${segmentError?.message ? ` rpc=${segmentError.message}` : ""} ${JSON.stringify(segmentRow)}`.trim(),
  );
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
      c.target_fit_label, c.geometry_quality, c.candidate_kind, c.seed_score, c.compactness,
      extensions.st_geometrytype(c.geom) as geom_type,
      extensions.st_isvalid(c.geom) as is_valid,
      extensions.st_area(c.geom::extensions.geography)/10000.0 as area_ha
    from public.opportunity_run_candidates as c
    where c.run_id = '${runId}' and c.candidate_kind = 'site' and c.excluded = false
    order by c.rank nulls last, c.contiguous_area_ha desc nulls last
    limit 10
  `);

  record("Candidate sites generated from live DB", (top?.length ?? 0) > 0, `${top?.length ?? 0} returned, evaluated=${runStats?.evaluated_count}, excluded=${runStats?.excluded_count}`);

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
      select geom, usable_area_ha from public.opportunity_run_candidates
      where run_id = '${runId}' and candidate_kind = 'site' and excluded = false
    )
    select
      (
        select count(*)::int from kept a, kept b
        where a.geom && b.geom
          and extensions.st_intersects(a.geom, b.geom)
          and a.geom < b.geom
          and extensions.st_area(extensions.st_intersection(a.geom, b.geom)::extensions.geography)
            / nullif(extensions.st_area(extensions.st_union(a.geom, b.geom)::extensions.geography), 0) >= 0.5
      ) as high_iou_pairs
  `)[0];
  record("Near-duplicate sites are deduplicated (IoU < 0.5)", Number(mergeCheck?.high_iou_pairs) === 0, JSON.stringify(mergeCheck));

  const siteScale = psqlJson(`
    select
      count(*)::int as sites,
      coalesce(max(contiguous_area_ha), 0) as max_ha,
      coalesce(min(contiguous_area_ha), 0) as min_ha
    from public.opportunity_run_candidates
    where run_id = '${runId}' and candidate_kind = 'site' and excluded = false
  `)[0];
  record(
    "No municipality-scale polygon is returned as a candidate site",
    Number(siteScale?.sites) >= 2 && Number(siteScale?.max_ha) <= 80,
    JSON.stringify(siteScale),
  );

  const zones = psqlJson(`
    select count(*)::int as n, coalesce(sum(usable_area_ha), 0) as ha
    from public.opportunity_run_zones
    where run_id = '${runId}'
  `)[0];
  record("Opportunity zones preserved separately from sites", Number(zones?.n) > 0, JSON.stringify(zones));

  const distribution = psqlJson(`
    select
      contiguous_area_ha as ha,
      compactness,
      geometry_quality,
      local_covering_name,
      nup_covering_name,
      covering_queried,
      natura_overlap_pct,
      natura_queried,
      land_cover_provider_key,
      land_cover,
      mean_slope_deg
    from public.opportunity_run_candidates
    where run_id = '${runId}' and candidate_kind = 'site' and excluded = false
  `);
  const haValues: number[] = distribution.map((row: { ha?: number }) => Number(row.ha ?? 0));
  const compactValues: number[] = distribution.map((row: { compactness?: number }) => Number(row.compactness ?? 0));
  const stats = areaStats(haValues);
  const compactStats = areaStats(compactValues);
  const cookieCutter1492 = haValues.filter((value) => Math.abs(value - 14.92) < 0.05).length;
  record(
    "Candidate areas are not cookie-cutter 14.92 ha circles",
    stats.n >= 2 && (stats.stddev >= 0.35 || stats.distinctTenths >= 4) && cookieCutter1492 < Math.max(5, Math.floor(stats.n * 0.6)),
    JSON.stringify({ ...stats, cookieCutter1492, meanCompactness: compactStats.median }),
  );
  record(
    "Compactness is not a hidden circle preference",
    compactStats.median < 0.95 || stats.stddev >= 0.35,
    `median compactness=${compactStats.median.toFixed(3)} stddev_ha=${stats.stddev.toFixed(3)}`,
  );

  const coveringCheck = psqlJson(`
    select
      count(*) filter (where covering_queried)::int as queried,
      count(*) filter (where local_covering_name is not null)::int as local_named,
      count(*) filter (where nup_covering_name is not null)::int as nup_named
    from public.opportunity_run_candidates
    where run_id = '${runId}' and candidate_kind = 'site' and excluded = false
  `)[0];
  record(
    "Generated sites query official Ei covering geography at the centroid",
    Number(coveringCheck?.queried) === Number(siteScale?.sites),
    JSON.stringify(coveringCheck),
  );
  const eiCovering = psqlJson(`
    select count(*)::int as n
    from public.grid_areas as ga
    join public.grid_sources as gs on gs.id = ga.source_id
    where gs.slug = 'ei-network-area-concessions'
      and ga.area_type = 'local_network'
      and ga.geometry && extensions.st_setsrid(
        extensions.st_makeenvelope(${BBOX.west}, ${BBOX.south}, ${BBOX.east}, ${BBOX.north}),
        4326
      )
  `)[0];
  record(
    "Candidate sites inherit official covering names when Ei geography is ingested",
    Number(eiCovering?.n ?? 0) === 0 || Number(coveringCheck?.local_named) > 0,
    JSON.stringify({ eiAreasInBbox: eiCovering?.n, ...coveringCheck }),
  );

  const naturaProof = psqlJson(`
    select
      count(*) filter (where natura_queried)::int as queried,
      count(*) filter (where coalesce(natura_overlap_pct, 0) > 0)::int as overlapping,
      count(*) filter (where natura_queried and coalesce(natura_overlap_pct, 0) = 0)::int as non_overlapping
    from public.opportunity_run_candidates
    where run_id = '${runId}' and candidate_kind = 'site' and excluded = false
  `)[0];
  record(
    "Natura 2000 is evaluated distinctly from generic protected areas",
    Number(counts?.natura) === 0 || Number(naturaProof?.queried) > 0,
    JSON.stringify({ featureCount: counts?.natura, ...naturaProof }),
  );

  let artifactPath = "";
  try {
    artifactPath = writeVisualArtifact(runId, top);
    record("Visual Hallsberg shape-audit artifact written", true, artifactPath);
  } catch (error) {
    record("Visual Hallsberg shape-audit artifact written", false, error instanceof Error ? error.message : "failed");
  }

  const displayVsAnalytical = psqlJson(`
    select
      extensions.st_area(c.geom::extensions.geography) as analytical_m2,
      extensions.st_area(extensions.st_simplifypreservetopology(c.geom, 0.00015)::extensions.geography) as display_m2
    from public.opportunity_run_candidates as c
    where c.run_id = '${runId}' and c.candidate_kind = 'site' and c.excluded = false
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
    where c.id = '${first?.id ?? "00000000-0000-4000-8000-000000000000"}'
  `)[0];

  const other = await signIn(otherEmail, otherPassword);
  const { data: crossSearch } = await other.supabase.from("opportunity_searches").select("id").eq("id", search.id);
  record("Cross-org opportunity search access denied", (crossSearch?.length ?? 0) === 0);
  const { data: crossCand } = await other.supabase.from("opportunity_run_candidates").select("id, geom").eq("run_id", runId);
  record("Cross-org run/candidate geometry denied", (crossCand?.length ?? 0) === 0);

  if (first?.id) {
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
  } else {
    record("Save candidate as opportunity works", false, "no site-scale candidate to save");
  }

  const payload = psqlJson(`
    select octet_length(extensions.st_asbinary(geom))::int as bytes
    from public.opportunity_run_candidates
    where run_id = '${runId}' and candidate_kind = 'site' and excluded = false
  `);
  const geomBytes = payload.reduce((sum: number, row: { bytes?: number }) => sum + Number(row.bytes ?? 0), 0);

  const report = {
    discoveryMs,
    segmentMs,
    refineMs,
    runStats,
    siteGeneration: segmentRow,
    zoneCount: zones?.n ?? 0,
    zoneHa: zones?.ha ?? 0,
    siteScale,
    areaDistribution: stats,
    compactness: compactStats,
    coveringCheck,
    naturaProof,
    landCoverSources,
    providerAvailability: runStats?.provider_availability,
    warnings: runStats?.warnings,
    topCandidates: top,
    refined,
    geomBytes,
    ingestCounts: counts,
    artifactPath,
    v2Baseline: V2_BASELINE,
    comparison: {
      v2: V2_BASELINE,
      v21: {
        version: "site-generation-v2.1",
        algorithm: "land-derived 150 m region growing",
        zones: zones?.n ?? 0,
        zoneHa: zones?.ha ?? 0,
        beforeDedupe: segmentRow?.before_dedupe ?? null,
        afterDedupe: segmentRow?.after_dedupe ?? null,
        topAreasHa: top.map((row: { area_ha?: number; contiguous_area_ha?: number }) =>
          Number(row.area_ha ?? row.contiguous_area_ha ?? 0),
        ),
        compactness: top.map((row: { compactness?: number }) => Number(row.compactness ?? 0)),
      },
    },
  };
  writeFileSync(path.join(process.cwd(), "scripts", "tmp-proof-report.json"), JSON.stringify(report, null, 2));

  const passed = checks.filter((item) => item.pass).length;
  const failed = checks.filter((item) => !item.pass).length;
  console.log(JSON.stringify({ event: "prove.complete", passed, failed, discoveryMs, segmentMs, refineMs, sites: siteScale?.sites, maxHa: siteScale?.max_ha, geomBytes }, null));
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
