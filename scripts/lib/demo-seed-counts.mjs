import { DEMO_ORG_ID } from "./sales-demo-portfolio.mjs";
import { lit } from "./demo-seed-sql.mjs";

export function demoInventorySql() {
  return `
select
  (select count(*)::int from public.opportunity_searches where organization_id = ${lit(DEMO_ORG_ID)}) as searches,
  (select count(*)::int from public.opportunity_search_runs where organization_id = ${lit(DEMO_ORG_ID)}) as runs,
  (select count(*)::int from public.opportunity_run_candidates where organization_id = ${lit(DEMO_ORG_ID)} and coalesce(candidate_kind, 'site') = 'site') as candidates,
  (select count(*)::int from public.opportunity_run_zones where organization_id = ${lit(DEMO_ORG_ID)}) as zones,
  (select count(*)::int from public.development_opportunities where organization_id = ${lit(DEMO_ORG_ID)}) as opportunities,
  (select count(*)::int from public.portfolio_comparisons where organization_id = ${lit(DEMO_ORG_ID)}) as comparisons,
  (select count(*)::int from public.projects where organization_id = ${lit(DEMO_ORG_ID)}) as projects,
  (select count(*)::int from public.connection_cases c
    inner join public.projects p on p.id = c.project_id
    where p.organization_id = ${lit(DEMO_ORG_ID)}) as connection_cases,
  (select count(*)::int from public.project_requirements r
    inner join public.projects p on p.id = r.project_id
    where p.organization_id = ${lit(DEMO_ORG_ID)}) as requirements,
  (select count(*)::int from public.documents d
    inner join public.projects p on p.id = d.project_id
    where p.organization_id = ${lit(DEMO_ORG_ID)}) as documents,
  (select count(*)::int from public.projects where organization_id <> ${lit(DEMO_ORG_ID)}) as other_org_projects,
  (select count(*)::int from public.organizations where id <> ${lit(DEMO_ORG_ID)}) as other_organizations,
  (select count(*)::int from public.alerts where organization_id = ${lit(DEMO_ORG_ID)}) as demo_alerts,
  (select count(*)::int from public.external_changes) as external_changes
;
`.trim();
}

export function demoMembersSql() {
  return `
select
  m.profile_id::text as profile_id,
  m.role,
  (
    select count(*)::int
    from public.organization_members as other
    where other.profile_id = m.profile_id
      and other.organization_id <> ${lit(DEMO_ORG_ID)}
  ) as other_org_memberships
from public.organization_members as m
where m.organization_id = ${lit(DEMO_ORG_ID)}
order by
  case m.role when 'owner' then 0 when 'admin' then 1 when 'member' then 2 else 3 end,
  m.profile_id;
`.trim();
}

export function orebroScreeningPrereqSql(bbox) {
  return `
select
  exists (
    select 1 from public.official_geographic_features
    where feature_class = 'protected_area'
  ) as protected_catalog,
  exists (
    select 1 from public.official_geographic_features
    where feature_class = 'natura_2000'
  ) as natura_catalog,
  exists (
    select 1 from public.official_physical_summaries
    where summary_class = 'land_cover'
      and geom operator(extensions.&&) extensions.st_setsrid(
        extensions.st_makeenvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}),
        4326
      )
  ) as land_cover_in_bbox,
  exists (
    select 1 from public.official_physical_summaries
    where summary_class = 'terrain'
      and geom operator(extensions.&&) extensions.st_setsrid(
        extensions.st_makeenvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}),
        4326
      )
  ) as terrain_in_bbox
;
`.trim();
}

export function normalizeInventory(row = {}) {
  const n = (key) => Number(row[key] ?? 0);
  return {
    searches: n("searches"),
    runs: n("runs"),
    candidates: n("candidates"),
    zones: n("zones"),
    opportunities: n("opportunities"),
    comparisons: n("comparisons"),
    projects: n("projects"),
    connection_cases: n("connection_cases"),
    requirements: n("requirements"),
    documents: n("documents"),
    other_org_projects: n("other_org_projects"),
    other_organizations: n("other_organizations"),
    demo_alerts: n("demo_alerts"),
    external_changes: n("external_changes"),
  };
}
