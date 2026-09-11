import { queryIngestSql, runDemoSeedSql } from "./demo-seed-target.mjs";
import { lit, landCoverRulesJson } from "./demo-seed-sql.mjs";
import {
  DEMO_ORG_ID,
  LAND_COVER_RULES,
  PRIMARY_SEARCH,
  PROMOTED_PROJECT,
} from "./sales-demo-portfolio.mjs";
import {
  customerFacingOpportunityName,
  describeCompareSet,
  selectDemoOpportunityCandidates,
} from "./demo-seed-selection.mjs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function firstRow(rows) {
  return Array.isArray(rows) ? rows[0] : rows;
}

function wrapJwtSql(userId, body) {
  const claims = JSON.stringify({ sub: userId, role: "authenticated" }).replace(/'/g, "''");
  return `
select set_config('request.jwt.claims', '${claims}', true);
select set_config('request.jwt.claim.sub', '${userId}', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('statement_timeout', '600000', true);
${body}
`.trim();
}

function mutateSql(target, sql) {
  const dir = mkdtempSync(path.join(tmpdir(), "noxheim-demo-mut-"));
  const file = path.join(dir, "mutate.sql");
  try {
    writeFileSync(file, `${sql}\n`, "utf8");
    return runDemoSeedSql(target, file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function slugify(name) {
  return String(name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function executeDemoDiscovery({ target, actorId, querySql = queryIngestSql }) {
  if (!actorId) {
    throw new Error("DEMO USER REQUIRED: screening RPCs need an existing demo-org owner/admin/member. No user was created.");
  }

  const searchSql = `
insert into public.opportunity_searches (
  organization_id, created_by, name, technology, country, region, municipality,
  west, south, east, north,
  min_site_area_ha, target_site_area_ha, max_candidate_area_ha, max_returned_candidates,
  exclude_protected, exclude_natura, max_slope_degrees, slope_mode,
  land_cover_rules, max_road_distance_m, road_mode, criteria
) values (
  ${lit(DEMO_ORG_ID)},
  ${lit(actorId)},
  ${lit(PRIMARY_SEARCH.name)},
  ${lit(PRIMARY_SEARCH.technology)},
  ${lit(PRIMARY_SEARCH.country)},
  ${lit(PRIMARY_SEARCH.region)},
  ${lit(PRIMARY_SEARCH.municipality)},
  ${PRIMARY_SEARCH.bbox.west},
  ${PRIMARY_SEARCH.bbox.south},
  ${PRIMARY_SEARCH.bbox.east},
  ${PRIMARY_SEARCH.bbox.north},
  ${PRIMARY_SEARCH.minSiteAreaHa},
  ${PRIMARY_SEARCH.targetSiteAreaHa},
  ${PRIMARY_SEARCH.maxCandidateAreaHa},
  ${PRIMARY_SEARCH.maxReturnedCandidates},
  true,
  true,
  ${PRIMARY_SEARCH.maxSlopeDegrees},
  ${lit(PRIMARY_SEARCH.slopeMode)},
  ${lit(landCoverRulesJson())}::jsonb,
  ${PRIMARY_SEARCH.maxRoadDistanceM},
  ${lit(PRIMARY_SEARCH.roadMode)},
  ${lit(
    JSON.stringify({
      technology: PRIMARY_SEARCH.technology,
      bbox: PRIMARY_SEARCH.bbox,
      rankingVersion: PRIMARY_SEARCH.rankingVersion,
      methodologyVersion: PRIMARY_SEARCH.methodologyVersion,
      landCover: LAND_COVER_RULES,
    }),
  )}::jsonb
)
returning id::text as id;
`;
  const searchRow = firstRow(querySql(target, searchSql));
  const searchId = searchRow?.id;
  if (!searchId) {
    throw new Error("Demo discovery refused: could not create Örebro East BESS search.");
  }

  const authed = (body) => querySql(target, wrapJwtSql(actorId, body));

  authed(
    `select run_id::text as run_id, status, evaluated_count, warning_count
from public.execute_opportunity_screening_run(${lit(searchId)}::uuid);`,
  );
  const runRow = firstRow(
    querySql(
      target,
      `select id::text as run_id, status
from public.opportunity_search_runs
where search_id = ${lit(searchId)}
  and organization_id = ${lit(DEMO_ORG_ID)}
order by started_at desc
limit 1;`,
    ),
  );
  const runId = runRow?.run_id ?? runRow?.id;
  if (!runId) {
    throw new Error("Demo discovery refused: execute_opportunity_screening_run did not create a run.");
  }

  authed(
    `select zone_count, site_count, seed_count, before_dedupe, after_dedupe, duration_ms
from public.segment_opportunity_run_into_sites(${lit(runId)}::uuid);`,
  );

  const candidateRows = querySql(
    target,
    `select
      id::text as id,
      name,
      rank,
      recommendation,
      data_confidence,
      excluded,
      candidate_kind,
      latitude,
      longitude,
      gross_area_ha,
      usable_area_ha,
      contiguous_area_ha,
      protected_overlap_pct,
      natura_overlap_pct,
      protected_names,
      natura_names,
      local_covering_name,
      nup_covering_name,
      covering_queried,
      protected_queried,
      natura_queried,
      mean_slope_deg,
      median_slope_deg,
      p90_slope_deg,
      pct_below_slope,
      terrain_queried,
      land_cover,
      land_cover_queried,
      road_distance_m,
      road_class,
      road_queried,
      exclusion_breakdown,
      screening_stage,
      refinement_status,
      discovery_rank,
      detailed_rank,
      terrain_resolution,
      land_cover_resolution,
      terrain_provider_key,
      land_cover_provider_key,
      transmission_context,
      discovery_contiguous_area_ha,
      compactness,
      geometry_quality,
      target_fit_score
    from public.opportunity_run_candidates
    where run_id = ${lit(runId)}
      and organization_id = ${lit(DEMO_ORG_ID)}
      and coalesce(candidate_kind, 'site') = 'site';`,
  );

  if (!candidateRows.length) {
    throw new Error(
      "Demo discovery refused: screening produced no Candidate Sites. Official cache may not support this geography.",
    );
  }

  const { rankDemoRunCandidates, demoScreeningCriteria } = await import("./demo-seed-rank.ts");
  const criteria = demoScreeningCriteria({
    region: PRIMARY_SEARCH.region,
    municipality: PRIMARY_SEARCH.municipality,
  });
  const ranked = rankDemoRunCandidates(
    candidateRows.map((row) => ({
      ...row,
      transmission:
        row.transmission_context && typeof row.transmission_context === "object"
          ? row.transmission_context
          : null,
    })),
    criteria,
  );
  const payload = JSON.stringify(ranked).replace(/'/g, "''");
  authed(`select public.apply_opportunity_run_assessments(${lit(runId)}::uuid, '${payload}'::jsonb);`);

  const rankedRows = querySql(
    target,
    `select
      id::text as id,
      name,
      rank,
      recommendation,
      data_confidence,
      excluded,
      candidate_kind,
      local_covering_name,
      geometry_quality,
      contiguous_area_ha,
      usable_area_ha
    from public.opportunity_run_candidates
    where run_id = ${lit(runId)}
      and organization_id = ${lit(DEMO_ORG_ID)}
      and coalesce(candidate_kind, 'site') = 'site';`,
  );

  const assignments = selectDemoOpportunityCandidates(rankedRows);
  const compare = describeCompareSet(assignments);
  const saved = [];

  for (const assignment of assignments) {
    authed(
      `select opportunity_id::text as opportunity_id, slug
from public.save_opportunity_from_run_candidate(${lit(assignment.candidate.id)}::uuid);`,
    );
    const row = firstRow(
      querySql(
        target,
        `select o.id::text as id, o.slug, o.status, o.name
from public.development_opportunities as o
where o.originating_candidate_id = ${lit(assignment.candidate.id)}
  and o.organization_id = ${lit(DEMO_ORG_ID)}
limit 1;`,
      ),
    );
    if (!row?.id) {
      throw new Error(`Demo discovery refused: save_opportunity_from_run_candidate failed for ${assignment.candidate.id}.`);
    }
    saved.push({ ...assignment, opportunityId: row.id, slug: row.slug, status: row.status });
  }

  for (const item of saved) {
    const name = customerFacingOpportunityName(item.role, item.candidate, {
      promotedName: PROMOTED_PROJECT.name,
    });
    const slug =
      item.role === "promoted" ? PROMOTED_PROJECT.slug : `${slugify(name) || item.slug}-${item.role}`;
    const targetMw = item.role === "promoted" ? PROMOTED_PROJECT.mw : "null";
    mutateSql(
      target,
      `update public.development_opportunities
set
  name = ${lit(name)},
  slug = ${lit(slug)},
  target_mw = ${targetMw},
  updated_at = now()
where id = ${lit(item.opportunityId)}
  and organization_id = ${lit(DEMO_ORG_ID)};`,
    );
  }

  const shortlisted = saved.find((item) => item.role === "shortlisted");
  const underReview = saved.find((item) => item.role === "under_review");
  const rejected = saved.find((item) => item.role === "rejected");
  const promoted = saved.find((item) => item.role === "promoted");

  if (shortlisted) {
    mutateSql(
      target,
      `update public.development_opportunities
set status = 'shortlisted', updated_at = now()
where id = ${lit(shortlisted.opportunityId)} and organization_id = ${lit(DEMO_ORG_ID)};
insert into public.opportunity_events (opportunity_id, organization_id, title, detail, source)
values (
  ${lit(shortlisted.opportunityId)},
  ${lit(DEMO_ORG_ID)},
  'Shortlisted',
  'SAMPLE CUSTOMER DATA. Status set to shortlisted.',
  'Customer Data'
);`,
    );
  }
  if (underReview) {
    mutateSql(
      target,
      `update public.development_opportunities
set status = 'under_review', updated_at = now()
where id = ${lit(underReview.opportunityId)} and organization_id = ${lit(DEMO_ORG_ID)};
insert into public.opportunity_events (opportunity_id, organization_id, title, detail, source)
values (
  ${lit(underReview.opportunityId)},
  ${lit(DEMO_ORG_ID)},
  'Moved to under review',
  'SAMPLE CUSTOMER DATA. Status set to under_review.',
  'Customer Data'
);`,
    );
  }
  if (rejected) {
    mutateSql(
      target,
      `update public.development_opportunities
set
  status = 'rejected',
  rejection_reason = 'strategic_fit',
  rejection_note = 'SAMPLE CUSTOMER DATA. Held for portfolio focus. Not an official exclusion.',
  rejected_at = now(),
  rejected_by = ${lit(actorId)},
  updated_at = now()
where id = ${lit(rejected.opportunityId)} and organization_id = ${lit(DEMO_ORG_ID)};
insert into public.opportunity_events (opportunity_id, organization_id, title, detail, source)
values (
  ${lit(rejected.opportunityId)},
  ${lit(DEMO_ORG_ID)},
  'Rejected',
  'SAMPLE CUSTOMER DATA. Held for portfolio focus.',
  'Customer Data'
);`,
    );
  }

  if (!promoted) {
    throw new Error("Demo discovery refused: no Opportunity was selected for promotion.");
  }

  authed(
    `select project_id::text as project_id, project_slug
from public.promote_opportunity_to_project(${lit(promoted.opportunityId)}::uuid);`,
  );

  mutateSql(
    target,
    `update public.projects
set
  name = ${lit(PROMOTED_PROJECT.name)},
  slug = ${lit(PROMOTED_PROJECT.slug)},
  import_mw = ${PROMOTED_PROJECT.mw},
  export_mw = ${PROMOTED_PROJECT.mw},
  description = ${lit(
    "SAMPLE CUSTOMER DATA. Promoted from a real Örebro East BESS Candidate Site. Project remains a point; the Opportunity footprint is historic. Not Official Source.",
  )},
  updated_at = now()
where originating_opportunity_id = ${lit(promoted.opportunityId)}
  and organization_id = ${lit(DEMO_ORG_ID)};`,
  );

  return {
    searchId,
    runId,
    candidateCount: rankedRows.length,
    assignments: saved,
    compare,
  };
}
