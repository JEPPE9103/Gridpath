-- Precision screening: coarse discovery vs detailed refinement.
-- Do not rename 20260911120000 (already on main). This file sorts after it.
-- 1 km physical summaries remain discovery evidence only.

alter table public.official_physical_summaries
  add column if not exists resolution_m integer not null default 1000,
  add column if not exists taxonomy text;

update public.official_physical_summaries
set taxonomy = 'nmd_2018'
where summary_class = 'land_cover' and taxonomy is null;

alter table public.official_physical_summaries
  drop constraint if exists official_physical_summaries_taxonomy_check;
alter table public.official_physical_summaries
  add constraint official_physical_summaries_taxonomy_check
  check (taxonomy is null or taxonomy in ('nmd_2018', 'nmd_2023_v0', 'copernicus_glo90', 'lantmateriet_dtm_1m'));

create index if not exists official_physical_summaries_res_idx
  on public.official_physical_summaries (summary_class, resolution_m);

create table if not exists public.official_precision_summaries (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.grid_sources (id) on delete set null,
  snapshot_id uuid references public.source_snapshots (id) on delete set null,
  summary_class text not null check (summary_class in ('terrain', 'land_cover')),
  taxonomy text,
  resolution_m integer not null default 100,
  external_id text not null,
  geom extensions.geometry(Polygon, 4326) not null,
  mean_slope_deg numeric,
  median_slope_deg numeric,
  p90_slope_deg numeric,
  max_slope_deg numeric,
  pct_le_5 numeric,
  pct_le_8 numeric,
  pct_le_12 numeric,
  nmd_class integer,
  land_cover_group text,
  created_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create index if not exists official_precision_summaries_gix
  on public.official_precision_summaries using gist (geom);
create index if not exists official_precision_summaries_class_idx
  on public.official_precision_summaries (summary_class);

alter table public.official_precision_summaries enable row level security;
alter table public.official_precision_summaries force row level security;
revoke all on table public.official_precision_summaries from public, anon;
grant select on table public.official_precision_summaries to authenticated;
grant select, insert, update, delete on table public.official_precision_summaries to service_role;

drop policy if exists official_precision_summaries_select_authenticated on public.official_precision_summaries;
create policy official_precision_summaries_select_authenticated
  on public.official_precision_summaries for select to authenticated
  using (true);

create table if not exists public.official_administrative_areas (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.grid_sources (id) on delete set null,
  snapshot_id uuid references public.source_snapshots (id) on delete set null,
  area_class text not null check (area_class in ('county', 'municipality')),
  code text not null,
  name text not null,
  geom extensions.geometry(MultiPolygon, 4326) not null,
  created_at timestamptz not null default now(),
  unique (area_class, code)
);

create index if not exists official_administrative_areas_gix
  on public.official_administrative_areas using gist (geom);

alter table public.official_administrative_areas enable row level security;
alter table public.official_administrative_areas force row level security;
revoke all on table public.official_administrative_areas from public, anon;
grant select on table public.official_administrative_areas to authenticated;
grant select, insert, update, delete on table public.official_administrative_areas to service_role;

drop policy if exists official_administrative_areas_select_authenticated on public.official_administrative_areas;
create policy official_administrative_areas_select_authenticated
  on public.official_administrative_areas for select to authenticated
  using (true);

comment on table public.official_administrative_areas is
  'SCB Digitala gränser (CC0) for naming, municipality filter and county attachment. SCB states these simplified boundaries are not suitable for cadastral analysis. They are never used to clip usable site geometry. Lantmäteriet Kommun/län/rike remains preferred when Geotorget access exists.';

create table if not exists public.official_transmission_context (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.grid_sources (id) on delete set null,
  snapshot_id uuid references public.source_snapshots (id) on delete set null,
  county_code text not null,
  county_name text not null,
  year integer not null default 2026,
  direction text check (direction in ('consumption', 'generation')),
  indicative_band_mw text,
  applied_mw numeric,
  reserved_mw numeric,
  allocated_mw numeric,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (county_code, year, direction)
);

alter table public.official_transmission_context enable row level security;
alter table public.official_transmission_context force row level security;
revoke all on table public.official_transmission_context from public, anon;
grant select on table public.official_transmission_context to authenticated;
grant select, insert, update, delete on table public.official_transmission_context to service_role;

drop policy if exists official_transmission_context_select_authenticated on public.official_transmission_context;
create policy official_transmission_context_select_authenticated
  on public.official_transmission_context for select to authenticated
  using (true);

comment on table public.official_transmission_context is
  'Official Indicative Transmission Context at published county geography. Empty until a production-safe structured SvK source exists. Never a site-level capacity estimate.';

alter table public.opportunity_run_candidates
  add column if not exists screening_stage text not null default 'discovery',
  add column if not exists refinement_status text not null default 'discovery',
  add column if not exists discovery_rank integer,
  add column if not exists detailed_rank integer,
  add column if not exists discovery_geom extensions.geometry(MultiPolygon, 4326),
  add column if not exists discovery_contiguous_area_ha numeric,
  add column if not exists terrain_resolution text,
  add column if not exists land_cover_resolution text,
  add column if not exists terrain_provider_key text,
  add column if not exists land_cover_provider_key text,
  add column if not exists strategic_flags jsonb not null default '[]'::jsonb,
  add column if not exists rank_change_explanation text,
  add column if not exists transmission_context jsonb not null default '{}'::jsonb,
  add column if not exists county_name text,
  add column if not exists municipality_name text,
  add column if not exists refinement_duration_ms integer,
  add column if not exists refinement_error text;

alter table public.opportunity_run_candidates
  drop constraint if exists opportunity_run_candidates_stage_check;
alter table public.opportunity_run_candidates
  add constraint opportunity_run_candidates_stage_check
  check (screening_stage in ('discovery', 'detailed'));

alter table public.opportunity_run_candidates
  drop constraint if exists opportunity_run_candidates_refinement_check;
alter table public.opportunity_run_candidates
  add constraint opportunity_run_candidates_refinement_check
  check (refinement_status in (
    'discovery', 'eligible_for_refinement', 'refining', 'refined', 'refinement_failed', 'saved_as_opportunity'
  ));

alter table public.opportunity_search_runs
  add column if not exists screening_stage text not null default 'discovery',
  add column if not exists operational_metrics jsonb not null default '{}'::jsonb;

create table if not exists public.opportunity_assessment_versions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.development_opportunities (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version_number integer not null,
  assessed_at timestamptz not null default now(),
  ranking_version text,
  methodology_version text,
  source_versions jsonb not null default '{}'::jsonb,
  contiguous_area_ha numeric,
  usable_area_ha numeric,
  snapshot jsonb not null default '{}'::jsonb,
  change_summary text,
  unique (opportunity_id, version_number)
);

alter table public.opportunity_assessment_versions enable row level security;
alter table public.opportunity_assessment_versions force row level security;
revoke all on table public.opportunity_assessment_versions from public, anon;
grant select, insert on table public.opportunity_assessment_versions to authenticated;
grant select, insert, update, delete on table public.opportunity_assessment_versions to service_role;

drop policy if exists opportunity_assessment_versions_select on public.opportunity_assessment_versions;
create policy opportunity_assessment_versions_select
  on public.opportunity_assessment_versions for select to authenticated
  using (private.belongs_to_organization(organization_id));

drop policy if exists opportunity_assessment_versions_insert on public.opportunity_assessment_versions;
create policy opportunity_assessment_versions_insert
  on public.opportunity_assessment_versions for insert to authenticated
  with check (private.can_write_organization(organization_id));

create table if not exists public.opportunity_reassessment_notices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  opportunity_id uuid not null references public.development_opportunities (id) on delete cascade,
  provider_slug text not null,
  notice text not null,
  status text not null default 'open' check (status in ('open', 'reassessed', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists opportunity_reassessment_notices_org_idx
  on public.opportunity_reassessment_notices (organization_id, status);

alter table public.opportunity_reassessment_notices enable row level security;
alter table public.opportunity_reassessment_notices force row level security;
revoke all on table public.opportunity_reassessment_notices from public, anon;
grant select, insert, update on table public.opportunity_reassessment_notices to authenticated;
grant select, insert, update, delete on table public.opportunity_reassessment_notices to service_role;

drop policy if exists opportunity_reassessment_notices_select on public.opportunity_reassessment_notices;
create policy opportunity_reassessment_notices_select
  on public.opportunity_reassessment_notices for select to authenticated
  using (private.belongs_to_organization(organization_id));

drop policy if exists opportunity_reassessment_notices_write on public.opportunity_reassessment_notices;
create policy opportunity_reassessment_notices_write
  on public.opportunity_reassessment_notices for insert to authenticated
  with check (private.can_write_organization(organization_id));

drop policy if exists opportunity_reassessment_notices_update on public.opportunity_reassessment_notices;
create policy opportunity_reassessment_notices_update
  on public.opportunity_reassessment_notices for update to authenticated
  using (private.can_write_organization(organization_id))
  with check (private.can_write_organization(organization_id));

create or replace function public.flag_opportunity_reassessment(p_slug text, p_notice text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  insert into public.opportunity_reassessment_notices (
    organization_id, opportunity_id, provider_slug, notice
  )
  select
    o.organization_id,
    o.id,
    p_slug,
    p_notice
  from public.development_opportunities as o
  where o.promoted_project_id is null
    and o.status <> 'rejected'
    and coalesce(o.screening_snapshot -> 'sourceVersions' ->> p_slug, '') is distinct from (
      select ss.content_hash
      from public.source_snapshots as ss
      inner join public.grid_sources as gs on gs.id = ss.source_id
      where gs.slug = p_slug
        and ss.status in ('success', 'unchanged')
      order by ss.retrieved_at desc
      limit 1
    )
    and not exists (
      select 1
      from public.opportunity_reassessment_notices as n
      where n.opportunity_id = o.id
        and n.provider_slug = p_slug
        and n.status = 'open'
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.flag_opportunity_reassessment(text, text) from public, anon;
grant execute on function public.flag_opportunity_reassessment(text, text) to service_role;

drop function if exists public.list_source_health();

create function public.list_source_health()
returns table (
  source_id uuid,
  slug text,
  name text,
  publisher text,
  refresh_interval_hours integer,
  last_attempt_at timestamptz,
  last_attempt_status text,
  last_attempt_source_changed boolean,
  last_attempt_error_code text,
  last_success_at timestamptz,
  last_full_ingest_at timestamptz,
  last_snapshot_id uuid,
  last_snapshot_at timestamptz,
  last_source_change_at timestamptz,
  next_eligible_at timestamptz,
  last_run_probe_only boolean,
  last_run_full_ingest_required boolean,
  last_observations_processed integer,
  last_external_changes_created integer,
  last_impacts_created integer,
  is_running boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    gs.id,
    gs.slug,
    gs.name,
    gs.publisher,
    coalesce(gs.refresh_interval_hours, 168),
    latest.started_at,
    latest.status,
    latest.source_changed,
    latest.error_code,
    success.completed_at,
    full_ingest.completed_at,
    snap.id,
    snap.retrieved_at,
    changes.detected_at,
    case
      when full_ingest.completed_at is null then now()
      else full_ingest.completed_at + make_interval(hours => coalesce(gs.refresh_interval_hours, 168))
    end,
    coalesce((latest.metadata ->> 'probe_only')::boolean, false),
    coalesce((latest.metadata ->> 'full_ingest_required')::boolean, false),
    latest.observations_processed,
    latest.external_changes_created,
    latest.impacts_created,
    exists (
      select 1
      from public.source_ingestion_runs as running
      where running.grid_source_id = gs.id
        and running.status = 'running'
    )
  from public.grid_sources as gs
  left join lateral (
    select
      r.started_at,
      r.status,
      r.source_changed,
      r.error_code,
      r.metadata,
      r.completed_at,
      r.observations_processed,
      r.external_changes_created,
      r.impacts_created
    from public.source_ingestion_runs as r
    where r.grid_source_id = gs.id
    order by r.started_at desc
    limit 1
  ) as latest on true
  left join lateral (
    select r.completed_at
    from public.source_ingestion_runs as r
    where r.grid_source_id = gs.id
      and r.status = 'success'
    order by r.completed_at desc
    limit 1
  ) as success on true
  left join lateral (
    select r.completed_at
    from public.source_ingestion_runs as r
    where r.grid_source_id = gs.id
      and r.status = 'success'
      and coalesce((r.metadata ->> 'probe_only')::boolean, false) = false
    order by r.completed_at desc
    limit 1
  ) as full_ingest on true
  left join lateral (
    select ss.id, ss.retrieved_at
    from public.source_snapshots as ss
    where ss.source_id = gs.id
      and ss.status in ('success', 'unchanged')
    order by ss.retrieved_at desc
    limit 1
  ) as snap on true
  left join lateral (
    select max(ec.detected_at) as detected_at
    from public.external_changes as ec
    where ec.source_id = gs.id
  ) as changes on true
  where gs.active
    and gs.slug in (
      'ei-network-development-plans',
      'ei-network-area-concessions',
      'nv-protected-areas',
      'nv-natura-2000',
      'copernicus-dem-glo90',
      'nv-nmd-2023',
      'nv-nmd-2018',
      'trafikverket-inspire-roadlink',
      'scb-administrative-areas',
      'lantmateriet-dtm-1m',
      'svk-indicative-transmission-2026'
    )
  order by gs.name;
$$;

revoke all on function public.list_source_health() from public, anon;
grant execute on function public.list_source_health() to authenticated, service_role;

create or replace function public.apply_opportunity_run_assessments(
  p_run_id uuid,
  p_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_role text;
  v_run public.opportunity_search_runs%rowtype;
  v_row jsonb;
  v_excluded integer := 0;
  v_returned integer := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_run
  from public.opportunity_search_runs
  where id = p_run_id;

  if v_run.id is null then
    raise exception 'Search run not found' using errcode = '22023';
  end if;

  select m.role into v_role
  from public.organization_members as m
  where m.profile_id = v_user_id
    and m.organization_id = v_run.organization_id;

  if v_role is null or v_role not in ('owner', 'admin', 'member') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Assessment payload is required' using errcode = '22023';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    update public.opportunity_run_candidates
    set
      rank = nullif(v_row ->> 'rank', '')::integer,
      recommendation = coalesce(nullif(v_row ->> 'recommendation', ''), recommendation),
      recommendation_summary = v_row ->> 'recommendationSummary',
      data_confidence = coalesce(nullif(v_row ->> 'dataConfidence', ''), data_confidence),
      excluded = coalesce((v_row ->> 'excluded')::boolean, excluded),
      exclusion_reason = v_row ->> 'exclusionReason',
      key_positive = v_row ->> 'keyPositive',
      key_risk = v_row ->> 'keyRisk',
      screening = coalesce(v_row -> 'screening', screening),
      ranking_version = coalesce(nullif(v_row ->> 'rankingVersion', ''), ranking_version, 'suitability-v3'),
      strategic_flags = coalesce(v_row -> 'strategicFlags', strategic_flags),
      rank_change_explanation = v_row ->> 'rankChangeExplanation',
      detailed_rank = case
        when refinement_status = 'refined' then nullif(v_row ->> 'rank', '')::integer
        else detailed_rank
      end,
      discovery_rank = case
        when refinement_status = 'refined' then coalesce(discovery_rank, nullif(v_row ->> 'discoveryRank', '')::integer)
        else nullif(v_row ->> 'rank', '')::integer
      end,
      screening_stage = case
        when refinement_status = 'refined' then 'detailed'
        else 'discovery'
      end,
      refinement_status = case
        when saved_opportunity_id is not null then 'saved_as_opportunity'
        when refinement_status in ('refined', 'refining', 'refinement_failed') then refinement_status
        when coalesce((v_row ->> 'excluded')::boolean, excluded) then 'discovery'
        else 'eligible_for_refinement'
      end
    where id = (v_row ->> 'id')::uuid
      and run_id = p_run_id
      and organization_id = v_run.organization_id;
  end loop;

  update public.opportunity_run_candidates as c
  set
    county_name = adm.name,
    transmission_context = jsonb_build_object(
      'queried', true,
      'available', false,
      'providerKey', 'svk-indicative-transmission-2026',
      'status', 'blocked_no_structured_source',
      'geographyLevel', 'county',
      'countyName', adm.name,
      'year', 2026,
      'sourceName', 'Svenska kraftnät',
      'limitation', 'This is an aggregated county-level indication for the transmission network and does not indicate available capacity at this candidate site or in the underlying regional/local network.'
    )
  from public.official_administrative_areas as adm
  where c.run_id = p_run_id
    and c.organization_id = v_run.organization_id
    and adm.area_class = 'county'
    and c.centroid is not null
    and extensions.st_intersects(adm.geom, c.centroid);

  update public.opportunity_run_candidates as c
  set municipality_name = adm.name
  from public.official_administrative_areas as adm
  where c.run_id = p_run_id
    and c.organization_id = v_run.organization_id
    and adm.area_class = 'municipality'
    and c.centroid is not null
    and extensions.st_intersects(adm.geom, c.centroid);

  select
    count(*) filter (where c.excluded),
    count(*) filter (where not c.excluded)
  into v_excluded, v_returned
  from public.opportunity_run_candidates as c
  where c.run_id = p_run_id;

  update public.opportunity_run_candidates as c
  set
    land_cover_resolution = coalesce(
      c.land_cover_resolution,
      case when c.land_cover_queried then 'coarse' else 'unavailable' end
    ),
    terrain_resolution = coalesce(
      c.terrain_resolution,
      case when c.terrain_queried then 'coarse' else 'unavailable' end
    ),
    land_cover_provider_key = coalesce(
      c.land_cover_provider_key,
      case
        when exists (
          select 1
          from public.official_physical_summaries as s
          where s.summary_class = 'land_cover'
            and s.taxonomy = 'nmd_2023_v0'
            and s.geom operator(extensions.&&) c.geom
        ) then 'nv-nmd-2023'
        when c.land_cover_queried then 'nv-nmd-2018'
        else null
      end
    ),
    terrain_provider_key = coalesce(
      c.terrain_provider_key,
      case when c.terrain_queried then 'copernicus-dem-glo90' else null end
    )
  where c.run_id = p_run_id
    and c.organization_id = v_run.organization_id;

  update public.opportunity_search_runs
  set
    status = 'completed',
    excluded_count = v_excluded,
    returned_count = v_returned,
    ranking_version = 'suitability-v3',
    methodology_version = 'precision-screening-v1',
    screening_stage = case
      when exists (
        select 1
        from public.opportunity_run_candidates as c
        where c.run_id = p_run_id
          and c.refinement_status in ('refined', 'saved_as_opportunity')
      ) then 'detailed'
      else 'discovery'
    end,
    completed_at = now()
  where id = p_run_id;

  return p_run_id;
end;
$$;

create or replace function public.refine_opportunity_run_candidates(
  p_run_id uuid,
  p_candidate_ids uuid[]
)
returns table (
  refined_count integer,
  failed_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_role text;
  v_run public.opportunity_search_runs%rowtype;
  v_search public.opportunity_searches%rowtype;
  v_id uuid;
  v_refined integer := 0;
  v_failed integer := 0;
  v_started timestamptz;
  v_has_precision_lc boolean;
  v_has_precision_terrain boolean;
  v_lc_groups text[];
  v_cand public.opportunity_run_candidates%rowtype;
  v_usable extensions.geometry;
  v_excl extensions.geometry;
  v_part extensions.geometry;
  v_largest extensions.geometry;
  v_largest_ha numeric;
  v_gross numeric;
  v_remaining numeric;
  v_land_ha numeric := 0;
  v_terrain_ha numeric := 0;
begin
  perform set_config('statement_timeout', '90000', true);
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_run from public.opportunity_search_runs where id = p_run_id;
  if v_run.id is null then
    raise exception 'Search run not found' using errcode = '22023';
  end if;

  select m.role into v_role
  from public.organization_members as m
  where m.profile_id = v_user_id
    and m.organization_id = v_run.organization_id;
  if v_role is null or v_role not in ('owner', 'admin', 'member') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_candidate_ids is null or coalesce(array_length(p_candidate_ids, 1), 0) = 0 then
    raise exception 'Select at least one candidate to refine' using errcode = '22023';
  end if;
  if coalesce(array_length(p_candidate_ids, 1), 0) > 5 then
    raise exception 'Detailed screening is limited to 5 candidates at a time' using errcode = '22023';
  end if;

  select * into v_search from public.opportunity_searches where id = v_run.search_id;

  select coalesce(array_agg(key), '{}'::text[])
  into v_lc_groups
  from jsonb_each_text(coalesce(v_search.land_cover_rules, '{}'::jsonb))
  where value = 'excluded';

  foreach v_id in array p_candidate_ids
  loop
    v_started := clock_timestamp();
    begin
      select * into v_cand
      from public.opportunity_run_candidates
      where id = v_id
        and run_id = p_run_id
        and organization_id = v_run.organization_id
        and excluded = false
        and refinement_status in ('eligible_for_refinement', 'refined', 'refinement_failed');

      if v_cand.id is null then
        continue;
      end if;

      update public.opportunity_run_candidates
      set refinement_status = 'refining'
      where id = v_cand.id;

      if v_cand.discovery_geom is null then
        update public.opportunity_run_candidates
        set
          discovery_geom = geom,
          discovery_contiguous_area_ha = coalesce(discovery_contiguous_area_ha, contiguous_area_ha, usable_area_ha)
        where id = v_cand.id;
        v_cand.discovery_geom := v_cand.geom;
        v_cand.discovery_contiguous_area_ha := coalesce(v_cand.discovery_contiguous_area_ha, v_cand.contiguous_area_ha);
      end if;

      v_usable := coalesce(v_cand.discovery_geom, v_cand.geom);
      v_gross := extensions.st_area(v_usable::extensions.geography) / 10000.0;

      v_has_precision_lc := exists (
        select 1 from public.official_precision_summaries s
        where s.summary_class = 'land_cover'
          and s.geom operator(extensions.&&) v_usable
      );
      v_has_precision_terrain := exists (
        select 1 from public.official_precision_summaries s
        where s.summary_class = 'terrain'
          and s.geom operator(extensions.&&) v_usable
      );

      v_excl := null;
      if coalesce(array_length(v_lc_groups, 1), 0) > 0 and v_has_precision_lc then
        select extensions.st_unaryunion(extensions.st_collect(s.geom))
        into v_excl
        from public.official_precision_summaries as s
        where s.summary_class = 'land_cover'
          and s.land_cover_group = any (v_lc_groups)
          and s.geom operator(extensions.&&) v_usable
          and extensions.st_intersects(s.geom, v_usable);
        if v_excl is not null then
          v_land_ha := extensions.st_area(extensions.st_intersection(v_usable, v_excl)::extensions.geography) / 10000.0;
          v_usable := extensions.st_multi(
            extensions.st_collectionextract(
              extensions.st_makevalid(extensions.st_difference(v_usable, v_excl)),
              3
            )
          );
        end if;
      end if;

      if v_search.slope_mode = 'hard' and v_search.max_slope_degrees is not null and v_has_precision_terrain then
        select extensions.st_unaryunion(extensions.st_collect(s.geom))
        into v_excl
        from public.official_precision_summaries as s
        where s.summary_class = 'terrain'
          and s.mean_slope_deg is not null
          and s.mean_slope_deg > v_search.max_slope_degrees
          and s.geom operator(extensions.&&) v_usable
          and extensions.st_intersects(s.geom, v_usable);
        if v_excl is not null then
          v_terrain_ha := extensions.st_area(extensions.st_intersection(v_usable, v_excl)::extensions.geography) / 10000.0;
          v_usable := extensions.st_multi(
            extensions.st_collectionextract(
              extensions.st_makevalid(extensions.st_difference(v_usable, v_excl)),
              3
            )
          );
        end if;
      end if;

      v_largest := null;
      v_largest_ha := 0;
      if v_usable is not null and not extensions.st_isempty(v_usable) then
        for v_part in
          select (extensions.st_dump(
            extensions.st_collectionextract(extensions.st_makevalid(v_usable), 3)
          )).geom
        loop
          if extensions.st_area(v_part::extensions.geography) / 10000.0 > v_largest_ha then
            v_largest := extensions.st_multi(v_part);
            v_largest_ha := extensions.st_area(v_part::extensions.geography) / 10000.0;
          end if;
        end loop;
      end if;

      if v_largest is null or v_largest_ha < 0.5 then
        v_largest := coalesce(v_cand.discovery_geom, v_cand.geom);
        v_largest_ha := coalesce(v_cand.discovery_contiguous_area_ha, v_cand.contiguous_area_ha, 0);
      end if;
      v_remaining := extensions.st_area(v_largest::extensions.geography) / 10000.0;

      update public.opportunity_run_candidates as c
      set
        geom = v_largest,
        centroid = extensions.st_centroid(v_largest),
        latitude = extensions.st_y(extensions.st_centroid(v_largest)),
        longitude = extensions.st_x(extensions.st_centroid(v_largest)),
        usable_area_ha = v_remaining,
        contiguous_area_ha = v_largest_ha,
        screening_stage = 'detailed',
        refinement_status = 'refined',
        land_cover_resolution = case when v_has_precision_lc then 'detailed' else coalesce(c.land_cover_resolution, 'coarse') end,
        terrain_resolution = case when v_has_precision_terrain then 'detailed' else coalesce(c.terrain_resolution, 'coarse') end,
        land_cover_provider_key = case
          when v_has_precision_lc then 'nv-nmd-2023'
          else coalesce(c.land_cover_provider_key, 'nv-nmd-2018')
        end,
        terrain_provider_key = case
          when v_has_precision_terrain then 'lantmateriet-dtm-1m'
          else coalesce(c.terrain_provider_key, 'copernicus-dem-glo90')
        end,
        exclusion_breakdown = coalesce(c.exclusion_breakdown, '{}'::jsonb) || jsonb_build_object(
          'refinementGrossHa', v_gross,
          'refinementLandCoverHa', v_land_ha,
          'refinementTerrainHa', v_terrain_ha,
          'refinementRemainingHa', v_remaining,
          'refinementLargestContiguousHa', v_largest_ha
        ),
        land_cover = coalesce((
          select jsonb_object_agg(land_cover_group, pct)
          from (
            select
              s.land_cover_group,
              100.0 * sum(extensions.st_area(extensions.st_intersection(s.geom, v_largest)::extensions.geography))
                / nullif(extensions.st_area(v_largest::extensions.geography), 0) as pct
            from public.official_precision_summaries as s
            where v_has_precision_lc
              and s.summary_class = 'land_cover'
              and s.land_cover_group is not null
              and s.geom operator(extensions.&&) v_largest
              and extensions.st_intersects(s.geom, v_largest)
            group by s.land_cover_group
          ) as grouped
        ), c.land_cover),
        land_cover_queried = c.land_cover_queried or v_has_precision_lc,
        mean_slope_deg = coalesce((
          select sum(s.mean_slope_deg * extensions.st_area(extensions.st_intersection(s.geom, v_largest)::extensions.geography))
            / nullif(sum(extensions.st_area(extensions.st_intersection(s.geom, v_largest)::extensions.geography)), 0)
          from public.official_precision_summaries as s
          where v_has_precision_terrain
            and s.summary_class = 'terrain'
            and s.geom operator(extensions.&&) v_largest
        ), c.mean_slope_deg),
        p90_slope_deg = coalesce((
          select sum(s.p90_slope_deg * extensions.st_area(extensions.st_intersection(s.geom, v_largest)::extensions.geography))
            / nullif(sum(extensions.st_area(extensions.st_intersection(s.geom, v_largest)::extensions.geography)), 0)
          from public.official_precision_summaries as s
          where v_has_precision_terrain
            and s.summary_class = 'terrain'
            and s.geom operator(extensions.&&) v_largest
        ), c.p90_slope_deg),
        pct_below_slope = coalesce((
          select sum(s.pct_le_5 * extensions.st_area(extensions.st_intersection(s.geom, v_largest)::extensions.geography))
            / nullif(sum(extensions.st_area(extensions.st_intersection(s.geom, v_largest)::extensions.geography)), 0)
          from public.official_precision_summaries as s
          where v_has_precision_terrain
            and s.summary_class = 'terrain'
            and s.geom operator(extensions.&&) v_largest
        ), c.pct_below_slope),
        terrain_queried = c.terrain_queried or v_has_precision_terrain,
        road_distance_m = coalesce((
          select extensions.st_distance(v_largest::extensions.geography, t.geom::extensions.geography)
          from public.official_transport_features as t
          where t.feature_class = 'road_link'
          order by v_largest operator(extensions.<->) t.geom
          limit 1
        ), c.road_distance_m),
        road_queried = c.road_queried or exists (select 1 from public.official_transport_features where feature_class = 'road_link'),
        refinement_duration_ms = greatest(1, floor(extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer),
        refinement_error = null
      where id = v_cand.id;

      v_refined := v_refined + 1;
    exception when others then
      update public.opportunity_run_candidates
      set
        refinement_status = 'refinement_failed',
        refinement_error = left(sqlerrm, 280)
      where id = v_id;
      v_failed := v_failed + 1;
    end;
  end loop;

  update public.opportunity_search_runs
  set
    screening_stage = 'detailed',
    operational_metrics = coalesce(operational_metrics, '{}'::jsonb) || jsonb_build_object(
      'lastRefineAt', now(),
      'lastRefinedCount', v_refined,
      'lastRefineFailedCount', v_failed
    )
  where id = p_run_id;

  refined_count := v_refined;
  failed_count := v_failed;
  return next;
end;
$$;

revoke all on function public.refine_opportunity_run_candidates(uuid, uuid[]) from public, anon;
grant execute on function public.refine_opportunity_run_candidates(uuid, uuid[]) to authenticated, service_role;

create or replace function public.get_opportunity_run_geojson(p_run_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_result jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;

  select organization_id into v_org
  from public.opportunity_search_runs
  where id = p_run_id;

  if v_org is null or not private.belongs_to_organization(v_org) then
    return null;
  end if;

  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(feature), '[]'::jsonb)
  )
  into v_result
  from (
    select jsonb_build_object(
      'type', 'Feature',
      'id', c.id,
      'geometry', extensions.st_asgeojson(
        case
          when extensions.st_isempty(extensions.st_simplifypreservetopology(c.geom, 0.00015))
            then c.geom
          else extensions.st_simplifypreservetopology(c.geom, 0.00015)
        end
      )::jsonb,
      'properties', jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'rank', c.rank,
        'recommendation', c.recommendation,
        'excluded', c.excluded,
        'usableAreaHa', c.usable_area_ha,
        'grossAreaHa', c.gross_area_ha,
        'contiguousAreaHa', c.contiguous_area_ha,
        'dataConfidence', c.data_confidence,
        'keyPositive', c.key_positive,
        'keyRisk', c.key_risk,
        'candidateKind', c.candidate_kind,
        'screeningStage', c.screening_stage,
        'refinementStatus', c.refinement_status,
        'terrainResolution', c.terrain_resolution,
        'landCoverResolution', c.land_cover_resolution
      )
    ) as feature
    from public.opportunity_run_candidates as c
    where c.run_id = p_run_id
      and c.organization_id = v_org
    order by c.rank nulls last, c.cell_index
    limit 250
  ) as features;

  return v_result;
end;
$$;

insert into public.grid_sources (
  name, slug, source_type, publisher, base_url, country_code, active, authority_level, update_frequency, refresh_interval_hours
) values
  (
    'Naturvårdsverket — NMD 2023 basskikt v0.3',
    'nv-nmd-2023',
    'gis',
    'Naturvårdsverket',
    'https://geodata.naturvardsverket.se/nedladdning/marktacke/NMD2023/',
    'SE',
    true,
    'official',
    'as_published',
    8760
  ),
  (
    'SCB — Digitala gränser (county/municipality)',
    'scb-administrative-areas',
    'gis',
    'Statistiska centralbyrån',
    'https://geodata.scb.se/geoserver/stat/ows',
    'SE',
    true,
    'official',
    'as_published',
    8760
  ),
  (
    'Lantmäteriet — Markhöjdmodell 1 m DTM',
    'lantmateriet-dtm-1m',
    'gis',
    'Lantmäteriet',
    'https://api.lantmateriet.se/stac-hojd/v1',
    'SE',
    true,
    'official',
    'as_published',
    8760
  ),
  (
    'Svenska kraftnät — Official Indicative Transmission Context 2026',
    'svk-indicative-transmission-2026',
    'gis',
    'Svenska kraftnät',
    'https://www.svk.se/aktorsportalen/anslut-till-transmissionsnatet/kapacitetskarta-transmissionsnatet/',
    'SE',
    true,
    'official',
    'as_published',
    720
  )
on conflict (slug) do update set name = excluded.name, active = true;

comment on table public.official_physical_summaries is
  'Coarse discovery summaries (typically 1 km). Not site-level evidence. Land cover: NMD 2023 majority class when ingested, else NMD 2018 legacy. Terrain: Copernicus GLO-90 DSM unless a later detailed source is labelled separately.';

comment on table public.official_precision_summaries is
  'Candidate-scoped higher-resolution summaries for detailed site screening. Not a nationwide 1 m terrain dump.';

-- execute_opportunity_screening_run remains in 20260911120000. Ranking version,
-- evidence labels and screening_stage are overwritten by apply_opportunity_run_assessments
-- and refine_opportunity_run_candidates in this file. Do not rename 20260911120000.
