-- Site Suitability Engine: contiguous candidate areas, screening profiles,
-- physical summaries (terrain / land cover), road links, ranking v2 snapshots.
-- Additive. Does not estimate available capacity or claim buildability.

-- ---------------------------------------------------------------------------
-- Official 1 km physical summaries (terrain slope, NMD land cover)
-- ---------------------------------------------------------------------------
create table public.official_physical_summaries (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.grid_sources (id) on delete cascade,
  snapshot_id uuid references public.source_snapshots (id) on delete set null,
  summary_class text not null,
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
  properties jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint official_physical_summaries_class_check check (
    summary_class in ('terrain', 'land_cover')
  ),
  constraint official_physical_summaries_source_external_key unique (source_id, external_id)
);

create index official_physical_summaries_geom_idx
  on public.official_physical_summaries using gist (geom);
create index official_physical_summaries_class_idx
  on public.official_physical_summaries (summary_class);

create trigger official_physical_summaries_set_updated_at
  before update on public.official_physical_summaries
  for each row execute function public.set_updated_at();

comment on table public.official_physical_summaries is
  '1 km screening summaries derived from official rasters. Terrain slope is Noxheim-derived from Copernicus DEM GLO-90 (DSM). Land cover is NMD 2018 majority class. Not cadastral parcels.';

alter table public.official_physical_summaries enable row level security;
alter table public.official_physical_summaries force row level security;
revoke all on table public.official_physical_summaries from public, anon;
grant select on table public.official_physical_summaries to authenticated;

create policy official_physical_summaries_select_authenticated
  on public.official_physical_summaries
  for select to authenticated
  using ((select auth.uid()) is not null);

-- ---------------------------------------------------------------------------
-- Official transport / road links
-- ---------------------------------------------------------------------------
create table public.official_transport_features (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.grid_sources (id) on delete cascade,
  snapshot_id uuid references public.source_snapshots (id) on delete set null,
  feature_class text not null default 'road_link',
  external_id text not null,
  name text,
  road_class text,
  geom extensions.geometry(MultiLineString, 4326) not null,
  properties jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint official_transport_features_class_check check (feature_class in ('road_link')),
  constraint official_transport_features_source_external_key unique (source_id, external_id)
);

create index official_transport_features_geom_idx
  on public.official_transport_features using gist (geom);

create trigger official_transport_features_set_updated_at
  before update on public.official_transport_features
  for each row execute function public.set_updated_at();

comment on table public.official_transport_features is
  'Official road centre-lines for screening proximity. Distance is not a heavy-transport access finding.';

alter table public.official_transport_features enable row level security;
alter table public.official_transport_features force row level security;
revoke all on table public.official_transport_features from public, anon;
grant select on table public.official_transport_features to authenticated;

create policy official_transport_features_select_authenticated
  on public.official_transport_features
  for select to authenticated
  using ((select auth.uid()) is not null);

insert into public.grid_sources (
  name, slug, source_type, publisher, base_url, country_code, active, authority_level, update_frequency, refresh_interval_hours
) values (
  'Copernicus DEM GLO-90 (derived 1 km slope summaries)',
  'copernicus-dem-glo90',
  'gis',
  'European Union / Copernicus',
  'https://copernicus-dem-90m.s3.amazonaws.com',
  'SE',
  true,
  'official',
  'as_published',
  8760
), (
  'Naturvårdsverket — NMD 2018 basskikt (1 km majority class)',
  'nv-nmd-2018',
  'gis',
  'Naturvårdsverket',
  'https://geodata.naturvardsverket.se/nedladdning/marktacke/nmd2018/bas_lan_ogen/',
  'SE',
  true,
  'official',
  'as_published',
  8760
), (
  'Trafikverket — INSPIRE RoadLink (NVDB)',
  'trafikverket-inspire-roadlink',
  'gis',
  'Trafikverket',
  'https://geo-inspire.trafikverket.se/MapService/wfs.axd/TN_RoadTransportNetwork',
  'SE',
  true,
  'official',
  'as_published',
  168
)
on conflict (slug) do update
set
  name = excluded.name,
  publisher = excluded.publisher,
  base_url = excluded.base_url,
  active = true,
  authority_level = 'official';

-- ---------------------------------------------------------------------------
-- Organisation screening profiles
-- ---------------------------------------------------------------------------
create table public.opportunity_screening_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null,
  origin text not null default 'customer',
  technology text not null,
  criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunity_screening_profiles_origin_check check (
    origin in ('noxheim_default', 'customer')
  ),
  constraint opportunity_screening_profiles_technology_check check (
    technology in (
      'battery_storage', 'solar', 'wind', 'hybrid', 'data_center',
      'ev_infrastructure', 'industrial', 'hydrogen', 'other'
    )
  )
);

create index opportunity_screening_profiles_org_idx
  on public.opportunity_screening_profiles (organization_id, technology);

create trigger opportunity_screening_profiles_set_updated_at
  before update on public.opportunity_screening_profiles
  for each row execute function public.set_updated_at();

alter table public.opportunity_screening_profiles enable row level security;
alter table public.opportunity_screening_profiles force row level security;
revoke all on table public.opportunity_screening_profiles from public, anon;
grant select, insert, update, delete on table public.opportunity_screening_profiles to authenticated;

create policy opportunity_screening_profiles_select_authenticated
  on public.opportunity_screening_profiles for select to authenticated
  using (private.belongs_to_organization(organization_id));

create policy opportunity_screening_profiles_insert_authenticated
  on public.opportunity_screening_profiles for insert to authenticated
  with check (private.can_write_organization(organization_id));

create policy opportunity_screening_profiles_update_authenticated
  on public.opportunity_screening_profiles for update to authenticated
  using (private.can_write_organization(organization_id))
  with check (private.can_write_organization(organization_id));

create policy opportunity_screening_profiles_delete_authenticated
  on public.opportunity_screening_profiles for delete to authenticated
  using (private.is_organization_admin(organization_id));

-- ---------------------------------------------------------------------------
-- Search / run / candidate / opportunity columns
-- ---------------------------------------------------------------------------
alter table public.opportunity_searches
  add column if not exists screening_profile_id uuid references public.opportunity_screening_profiles (id) on delete set null,
  add column if not exists slope_mode text not null default 'preference',
  add column if not exists max_slope_degrees numeric,
  add column if not exists land_cover_rules jsonb not null default '{}'::jsonb,
  add column if not exists max_road_distance_m numeric,
  add column if not exists road_mode text not null default 'preference',
  add column if not exists investigation_budget_note text,
  add column if not exists hurdle_note text;

alter table public.opportunity_searches
  drop constraint if exists opportunity_searches_slope_mode_check;
alter table public.opportunity_searches
  add constraint opportunity_searches_slope_mode_check
  check (slope_mode in ('hard', 'preference'));
alter table public.opportunity_searches
  drop constraint if exists opportunity_searches_road_mode_check;
alter table public.opportunity_searches
  add constraint opportunity_searches_road_mode_check
  check (road_mode in ('hard', 'preference'));

alter table public.opportunity_search_runs
  add column if not exists ranking_version text,
  add column if not exists methodology_version text,
  add column if not exists screening_profile_id uuid references public.opportunity_screening_profiles (id) on delete set null,
  add column if not exists change_summary text;

alter table public.opportunity_run_candidates
  add column if not exists candidate_kind text not null default 'area',
  add column if not exists contiguous_area_ha numeric,
  add column if not exists exclusion_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists mean_slope_deg numeric,
  add column if not exists median_slope_deg numeric,
  add column if not exists p90_slope_deg numeric,
  add column if not exists pct_below_slope numeric,
  add column if not exists terrain_queried boolean not null default false,
  add column if not exists land_cover jsonb not null default '{}'::jsonb,
  add column if not exists land_cover_queried boolean not null default false,
  add column if not exists road_distance_m numeric,
  add column if not exists road_class text,
  add column if not exists road_queried boolean not null default false,
  add column if not exists ranking_version text;

alter table public.opportunity_run_candidates
  drop constraint if exists opportunity_run_candidates_kind_check;
alter table public.opportunity_run_candidates
  add constraint opportunity_run_candidates_kind_check
  check (candidate_kind in ('area', 'cell'));

alter table public.development_opportunities
  add column if not exists screening_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists exclusion_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists contiguous_area_ha numeric;

-- ---------------------------------------------------------------------------
-- Source health
-- ---------------------------------------------------------------------------
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
      'nv-nmd-2018',
      'trafikverket-inspire-roadlink'
    )
  order by gs.name;
$$;

revoke all on function public.list_source_health() from public, anon;
grant execute on function public.list_source_health() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Candidate-area generation (dissolve remaining usable geometry)
-- ---------------------------------------------------------------------------
create or replace function public.execute_opportunity_screening_run(p_search_id uuid)
returns table (
  run_id uuid,
  status text,
  evaluated_count integer,
  warning_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_role text;
  v_search public.opportunity_searches%rowtype;
  v_run_id uuid;
  v_prev uuid;
  v_west double precision;
  v_south double precision;
  v_east double precision;
  v_north double precision;
  v_bbox extensions.geometry;
  v_bbox_3006 extensions.geometry;
  v_area_m2 double precision;
  v_cell_m double precision;
  v_nx integer;
  v_ny integer;
  v_protected_available boolean;
  v_natura_available boolean;
  v_terrain_available boolean;
  v_land_cover_available boolean;
  v_road_available boolean;
  v_env_excl extensions.geometry;
  v_terrain_excl extensions.geometry;
  v_lc_excl extensions.geometry;
  v_lc_groups text[];
  v_warnings jsonb := '[]'::jsonb;
  v_started timestamptz := clock_timestamp();
  v_evaluated integer := 0;
  v_prev_returned integer;
begin
  perform set_config('statement_timeout', '90000', true);

  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_search
  from public.opportunity_searches
  where id = p_search_id;

  if v_search.id is null then
    raise exception 'Search not found' using errcode = '22023';
  end if;

  select m.role into v_role
  from public.organization_members as m
  where m.profile_id = v_user_id
    and m.organization_id = v_search.organization_id;

  if v_role is null or v_role not in ('owner', 'admin', 'member') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_search.west is null or v_search.south is null or v_search.east is null or v_search.north is null then
    raise exception 'Search bounding box is required' using errcode = '22023';
  end if;

  v_west := greatest(v_search.west, 10.5);
  v_south := greatest(v_search.south, 55.0);
  v_east := least(v_search.east, 24.5);
  v_north := least(v_search.north, 69.6);

  if v_west >= v_east or v_south >= v_north then
    raise exception 'Bounding box does not intersect the supported Swedish envelope' using errcode = '22023';
  end if;

  v_bbox := extensions.st_setsrid(extensions.st_makeenvelope(v_west, v_south, v_east, v_north), 4326);
  v_bbox_3006 := extensions.st_transform(v_bbox, 3006);
  v_area_m2 := extensions.st_area(v_bbox_3006);

  if v_area_m2 > 15000000000 then
    raise exception 'Search area exceeds 15000 km². Narrow the bounding box.' using errcode = '22023';
  end if;

  v_cell_m := greatest(2000, least(10000, sqrt(v_area_m2 / 200.0)));
  if v_search.cell_size_m is not null and v_search.cell_size_m >= 2000 and v_search.cell_size_m <= 10000 then
    v_cell_m := v_search.cell_size_m;
  end if;

  v_nx := greatest(1, ceil((extensions.st_xmax(v_bbox_3006) - extensions.st_xmin(v_bbox_3006)) / v_cell_m)::integer);
  v_ny := greatest(1, ceil((extensions.st_ymax(v_bbox_3006) - extensions.st_ymin(v_bbox_3006)) / v_cell_m)::integer);
  if v_nx * v_ny > 250 then
    v_cell_m := sqrt(v_area_m2 / 200.0);
    v_nx := greatest(1, ceil((extensions.st_xmax(v_bbox_3006) - extensions.st_xmin(v_bbox_3006)) / v_cell_m)::integer);
    v_ny := greatest(1, ceil((extensions.st_ymax(v_bbox_3006) - extensions.st_ymin(v_bbox_3006)) / v_cell_m)::integer);
  end if;

  v_protected_available := exists (
    select 1 from public.official_geographic_features where feature_class = 'protected_area'
  );
  v_natura_available := exists (
    select 1 from public.official_geographic_features where feature_class = 'natura_2000'
  );
  v_terrain_available := exists (
    select 1 from public.official_physical_summaries
    where summary_class = 'terrain' and geom operator(extensions.&&) v_bbox
  );
  v_land_cover_available := exists (
    select 1 from public.official_physical_summaries
    where summary_class = 'land_cover' and geom operator(extensions.&&) v_bbox
  );
  v_road_available := exists (
    select 1 from public.official_transport_features
    where feature_class = 'road_link' and geom operator(extensions.&&) v_bbox
  );

  select coalesce(array_agg(key), '{}'::text[])
  into v_lc_groups
  from jsonb_each_text(coalesce(v_search.land_cover_rules, '{}'::jsonb))
  where value = 'excluded';

  if v_search.exclude_protected and not v_protected_available then
    v_warnings := v_warnings || jsonb_build_array(
      'Exclude protected areas is configured, but the Naturvårdsverket protected-area layer has not been ingested. Candidates were not eliminated on this rule.'
    );
  end if;
  if v_search.exclude_natura and not v_natura_available then
    v_warnings := v_warnings || jsonb_build_array(
      'Exclude Natura 2000 is configured, but the Naturvårdsverket Natura 2000 layer has not been ingested. Candidates were not eliminated on this rule.'
    );
  end if;
  if v_search.slope_mode = 'hard' and v_search.max_slope_degrees is not null and not v_terrain_available then
    v_warnings := v_warnings || jsonb_build_array(
      'Hard slope exclusion is configured, but Copernicus DEM slope summaries have not been ingested for this geography. The terrain constraint was not applied.'
    );
  end if;
  if coalesce(array_length(v_lc_groups, 1), 0) > 0 and not v_land_cover_available then
    v_warnings := v_warnings || jsonb_build_array(
      'Land-cover exclusions are configured, but NMD 2018 summaries have not been ingested for this geography. The land-cover constraint was not applied.'
    );
  end if;
  if (v_search.max_road_distance_m is not null or v_search.road_mode = 'hard') and not v_road_available then
    v_warnings := v_warnings || jsonb_build_array(
      'Road-access rules are configured, but Trafikverket RoadLink has not been ingested for this geography. The constraint was not applied.'
    );
  end if;
  if v_search.electricity_area is not null then
    v_warnings := v_warnings || jsonb_build_array(
      format(
        'Electricity area %s is recorded as search intent. Official reusable bidding-zone geometry is not integrated, so it was not used as a spatial filter.',
        v_search.electricity_area
      )
    );
  end if;
  v_warnings := v_warnings || jsonb_build_array(
    'Results are contiguous candidate areas after supported exclusions, not land parcels. Covering geography is not available capacity. Residential proximity is blocked pending data rights.'
  );

  select extensions.st_unaryunion(extensions.st_collect(extensions.st_makevalid(extensions.st_intersection(f.geom, v_bbox))))
  into v_env_excl
  from public.official_geographic_features as f
  where (v_search.exclude_protected or v_search.exclude_natura)
    and (
      (v_search.exclude_protected and v_protected_available and f.feature_class = 'protected_area')
      or (v_search.exclude_natura and v_natura_available and f.feature_class = 'natura_2000')
    )
    and f.geom operator(extensions.&&) v_bbox
    and extensions.st_intersects(f.geom, v_bbox);

  if v_search.slope_mode = 'hard' and v_search.max_slope_degrees is not null and v_terrain_available then
    select extensions.st_unaryunion(extensions.st_collect(s.geom))
    into v_terrain_excl
    from public.official_physical_summaries as s
    where s.summary_class = 'terrain'
      and s.geom operator(extensions.&&) v_bbox
      and s.mean_slope_deg is not null
      and s.mean_slope_deg > v_search.max_slope_degrees;
  end if;

  if coalesce(array_length(v_lc_groups, 1), 0) > 0 and v_land_cover_available then
    select extensions.st_unaryunion(extensions.st_collect(s.geom))
    into v_lc_excl
    from public.official_physical_summaries as s
    where s.summary_class = 'land_cover'
      and s.geom operator(extensions.&&) v_bbox
      and s.land_cover_group = any (v_lc_groups);
  end if;

  select r.id, r.returned_count into v_prev, v_prev_returned
  from public.opportunity_search_runs as r
  where r.search_id = v_search.id
    and r.status = 'completed'
  order by r.completed_at desc nulls last
  limit 1;

  insert into public.opportunity_search_runs (
    organization_id,
    search_id,
    created_by,
    previous_run_id,
    status,
    criteria,
    provider_availability,
    source_versions,
    warnings,
    methodology,
    ranking_version,
    methodology_version,
    screening_profile_id,
    cell_size_m,
    west, south, east, north
  ) values (
    v_search.organization_id,
    v_search.id,
    v_user_id,
    v_prev,
    'generating_cells',
    jsonb_build_object(
      'technology', v_search.technology,
      'country', v_search.country,
      'region', v_search.region,
      'municipality', v_search.municipality,
      'electricityArea', v_search.electricity_area,
      'targetMw', v_search.target_mw,
      'targetMwh', v_search.target_mwh,
      'minSiteAreaHa', v_search.min_site_area_ha,
      'maxDistanceKm', v_search.max_distance_km,
      'excludeProtected', v_search.exclude_protected,
      'excludeNatura', v_search.exclude_natura,
      'maxSlopePercent', v_search.max_slope_percent,
      'maxSlopeDegrees', v_search.max_slope_degrees,
      'slopeMode', v_search.slope_mode,
      'landCoverRules', v_search.land_cover_rules,
      'maxRoadDistanceM', v_search.max_road_distance_m,
      'roadMode', v_search.road_mode,
      'minDistanceResidentialM', v_search.min_distance_residential_m,
      'screeningProfileId', v_search.screening_profile_id
    ),
    jsonb_build_object(
      'nv-protected-areas', v_protected_available,
      'nv-natura-2000', v_natura_available,
      'ei-official-covering', true,
      'copernicus-dem-glo90', v_terrain_available,
      'nv-nmd-2018', v_land_cover_available,
      'trafikverket-inspire-roadlink', v_road_available,
      'residential', false,
      'grid-infrastructure', false
    ),
    jsonb_build_object(
      'nv-protected-areas', (
        select ss.content_hash from public.source_snapshots as ss
        inner join public.grid_sources as gs on gs.id = ss.source_id
        where gs.slug = 'nv-protected-areas' and ss.status in ('success', 'unchanged')
        order by ss.retrieved_at desc limit 1
      ),
      'nv-natura-2000', (
        select ss.content_hash from public.source_snapshots as ss
        inner join public.grid_sources as gs on gs.id = ss.source_id
        where gs.slug = 'nv-natura-2000' and ss.status in ('success', 'unchanged')
        order by ss.retrieved_at desc limit 1
      ),
      'copernicus-dem-glo90', (
        select ss.content_hash from public.source_snapshots as ss
        inner join public.grid_sources as gs on gs.id = ss.source_id
        where gs.slug = 'copernicus-dem-glo90' and ss.status in ('success', 'unchanged')
        order by ss.retrieved_at desc limit 1
      ),
      'nv-nmd-2018', (
        select ss.content_hash from public.source_snapshots as ss
        inner join public.grid_sources as gs on gs.id = ss.source_id
        where gs.slug = 'nv-nmd-2018' and ss.status in ('success', 'unchanged')
        order by ss.retrieved_at desc limit 1
      ),
      'trafikverket-inspire-roadlink', (
        select ss.content_hash from public.source_snapshots as ss
        inner join public.grid_sources as gs on gs.id = ss.source_id
        where gs.slug = 'trafikverket-inspire-roadlink' and ss.status in ('success', 'unchanged')
        order by ss.retrieved_at desc limit 1
      ),
      'ei-network-area-concessions', (
        select ss.content_hash from public.source_snapshots as ss
        inner join public.grid_sources as gs on gs.id = ss.source_id
        where gs.slug = 'ei-network-area-concessions' and ss.status in ('success', 'unchanged')
        order by ss.retrieved_at desc limit 1
      ),
      'ei-network-development-plans', (
        select ss.content_hash from public.source_snapshots as ss
        inner join public.grid_sources as gs on gs.id = ss.source_id
        where gs.slug = 'ei-network-development-plans' and ss.status in ('success', 'unchanged')
        order by ss.retrieved_at desc limit 1
      )
    ),
    v_warnings,
    'Bounded Swedish geography is analysed as EPSG:3006 cells. Remaining usable polygons after official exclusions are dissolved by shared-boundary union and dumped into contiguous Candidate Areas. Slivers below 0.5 ha are dropped. Screening uses largest contiguous usable area. Covering geography is not available capacity.',
    'suitability-v2',
    'site-suitability-v1',
    v_search.screening_profile_id,
    v_cell_m,
    v_west, v_south, v_east, v_north
  )
  returning id into v_run_id;

  insert into public.opportunity_run_candidates (
    organization_id,
    run_id,
    search_id,
    cell_index,
    candidate_kind,
    name,
    latitude,
    longitude,
    geom,
    centroid,
    gross_area_ha,
    excluded_area_ha,
    usable_area_ha,
    contiguous_area_ha,
    exclusion_breakdown,
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
    ranking_version
  )
  select
    v_search.organization_id,
    v_run_id,
    v_search.id,
    frag.cell_index,
    'area',
    format('%s candidate area %s', coalesce(nullif(v_search.region, ''), 'Screening'), frag.cell_index),
    extensions.st_y(frag.centroid),
    extensions.st_x(frag.centroid),
    frag.geom,
    frag.centroid,
    frag.gross_ha,
    greatest(frag.gross_ha - frag.usable_ha, 0),
    frag.usable_ha,
    frag.usable_ha,
    jsonb_build_object(
      'grossHa', frag.gross_ha,
      'protectedHa', frag.protected_ha,
      'naturaHa', frag.natura_ha,
      'terrainHa', frag.terrain_ha,
      'landCoverHa', frag.land_cover_ha,
      'remainingHa', frag.usable_ha,
      'largestContiguousHa', frag.usable_ha
    ),
    frag.protected_pct,
    frag.natura_pct,
    frag.protected_names,
    frag.natura_names,
    frag.local_name,
    frag.nup_name,
    true,
    v_protected_available,
    v_natura_available,
    frag.mean_slope_deg,
    frag.median_slope_deg,
    frag.p90_slope_deg,
    frag.pct_below_slope,
    v_terrain_available,
    frag.land_cover,
    v_land_cover_available,
    frag.road_distance_m,
    frag.road_class,
    v_road_available,
    'suitability-v2'
  from (
    with cells as (
      select
        clipped.geom as cell_geom,
        clipped.gross_ha,
        case
          when v_env_excl is null then clipped.geom
          else extensions.st_multi(
            extensions.st_collectionextract(
              extensions.st_makevalid(extensions.st_difference(clipped.geom, v_env_excl)),
              3
            )
          )
        end as after_env
      from generate_series(0, v_nx - 1) as gx(i)
      cross join generate_series(0, v_ny - 1) as gy(j)
      cross join lateral (
        select extensions.st_makeenvelope(
          extensions.st_xmin(v_bbox_3006) + gx.i * v_cell_m,
          extensions.st_ymin(v_bbox_3006) + gy.j * v_cell_m,
          extensions.st_xmin(v_bbox_3006) + (gx.i + 1) * v_cell_m,
          extensions.st_ymin(v_bbox_3006) + (gy.j + 1) * v_cell_m,
          3006
        ) as cell_3006
      ) as raw
      cross join lateral (
        select extensions.st_multi(
          extensions.st_collectionextract(
            extensions.st_makevalid(extensions.st_intersection(raw.cell_3006, v_bbox_3006)),
            3
          )
        ) as cell_3006
      ) as piece
      cross join lateral (
        select
          extensions.st_transform(piece.cell_3006, 4326) as geom,
          extensions.st_area(extensions.st_transform(piece.cell_3006, 4326)::extensions.geography) / 10000.0 as gross_ha
      ) as clipped
      where not extensions.st_isempty(piece.cell_3006)
        and clipped.gross_ha >= 1
    ),
    usable as (
      select
        cell_geom,
        gross_ha,
        case
          when v_terrain_excl is null then after_env
          else extensions.st_multi(
            extensions.st_collectionextract(
              extensions.st_makevalid(extensions.st_difference(after_env, v_terrain_excl)),
              3
            )
          )
        end as after_terrain
      from cells
    ),
    remaining as (
      select
        cell_geom,
        gross_ha,
        case
          when v_lc_excl is null then after_terrain
          else extensions.st_multi(
            extensions.st_collectionextract(
              extensions.st_makevalid(extensions.st_difference(after_terrain, v_lc_excl)),
              3
            )
          )
        end as usable_geom
      from usable
    ),
    dissolved as (
      select extensions.st_unaryunion(extensions.st_collect(usable_geom)) as geom
      from remaining
      where usable_geom is not null
        and not extensions.st_isempty(usable_geom)
        and extensions.st_area(usable_geom::extensions.geography) > 0
    ),
    parts as (
      select (extensions.st_dump(
        extensions.st_collectionextract(extensions.st_makevalid(dissolved.geom), 3)
      )).geom as geom
      from dissolved
      where dissolved.geom is not null
        and not extensions.st_isempty(dissolved.geom)
    ),
    cleaned as (
      select
        row_number() over (
          order by extensions.st_area(extensions.st_makevalid(parts.geom)::extensions.geography) desc
        ) as cell_index,
        extensions.st_multi(
          extensions.st_collectionextract(
            extensions.st_makevalid(extensions.st_snaptogrid(parts.geom, 0.000001)),
            3
          )
        ) as geom
      from parts
      where extensions.st_area(extensions.st_makevalid(parts.geom)::extensions.geography) / 10000.0 >= 0.5
    )
    select
      cleaned.cell_index,
      cleaned.geom,
      extensions.st_centroid(cleaned.geom) as centroid,
      coalesce(agg.gross_ha, extensions.st_area(cleaned.geom::extensions.geography) / 10000.0) as gross_ha,
      extensions.st_area(cleaned.geom::extensions.geography) / 10000.0 as usable_ha,
      coalesce(agg.protected_ha, 0) as protected_ha,
      coalesce(agg.natura_ha, 0) as natura_ha,
      coalesce(agg.terrain_ha, 0) as terrain_ha,
      coalesce(agg.land_cover_ha, 0) as land_cover_ha,
      coalesce(prot.overlap_pct, 0) as protected_pct,
      coalesce(nat.overlap_pct, 0) as natura_pct,
      coalesce(prot.names, '{}'::text[]) as protected_names,
      coalesce(nat.names, '{}'::text[]) as natura_names,
      local_cover.name as local_name,
      nup_cover.name as nup_name,
      terr.mean_slope_deg,
      terr.median_slope_deg,
      terr.p90_slope_deg,
      terr.pct_below_slope,
      coalesce(lc.land_cover, '{}'::jsonb) as land_cover,
      road.road_distance_m,
      road.road_class
    from cleaned
    left join lateral (
      select
        sum(r.gross_ha) as gross_ha,
        sum(
          case when v_env_excl is null then 0
          else greatest(
            0,
            extensions.st_area(extensions.st_intersection(r.cell_geom, v_env_excl)::extensions.geography) / 10000.0
          )
          end
        ) as protected_ha,
        0::numeric as natura_ha,
        sum(
          case when v_terrain_excl is null then 0
          else greatest(
            0,
            extensions.st_area(extensions.st_intersection(r.cell_geom, v_terrain_excl)::extensions.geography) / 10000.0
          )
          end
        ) as terrain_ha,
        sum(
          case when v_lc_excl is null then 0
          else greatest(
            0,
            extensions.st_area(extensions.st_intersection(r.cell_geom, v_lc_excl)::extensions.geography) / 10000.0
          )
          end
        ) as land_cover_ha
      from remaining as r
      where extensions.st_intersects(r.usable_geom, cleaned.geom)
         or extensions.st_intersects(r.cell_geom, cleaned.geom)
    ) as agg on true
    left join lateral (
      select
        case when count(*) = 0 then 0
        else 100.0 * extensions.st_area(
          extensions.st_intersection(cleaned.geom, extensions.st_unaryunion(extensions.st_collect(f.geom)))::extensions.geography
        ) / nullif(extensions.st_area(cleaned.geom::extensions.geography), 0)
        end as overlap_pct,
        coalesce(
          (array_agg(f.name order by extensions.st_area(
            extensions.st_intersection(cleaned.geom, f.geom)::extensions.geography
          ) desc) filter (where f.name is not null))[1:3],
          '{}'::text[]
        ) as names
      from public.official_geographic_features as f
      where v_protected_available
        and f.feature_class = 'protected_area'
        and f.geom operator(extensions.&&) cleaned.geom
        and extensions.st_intersects(f.geom, cleaned.geom)
    ) as prot on true
    left join lateral (
      select
        case when count(*) = 0 then 0
        else 100.0 * extensions.st_area(
          extensions.st_intersection(cleaned.geom, extensions.st_unaryunion(extensions.st_collect(f.geom)))::extensions.geography
        ) / nullif(extensions.st_area(cleaned.geom::extensions.geography), 0)
        end as overlap_pct,
        coalesce(
          (array_agg(f.name order by extensions.st_area(
            extensions.st_intersection(cleaned.geom, f.geom)::extensions.geography
          ) desc) filter (where f.name is not null))[1:3],
          '{}'::text[]
        ) as names
      from public.official_geographic_features as f
      where v_natura_available
        and f.feature_class = 'natura_2000'
        and f.geom operator(extensions.&&) cleaned.geom
        and extensions.st_intersects(f.geom, cleaned.geom)
    ) as nat on true
    left join lateral (
      select area.name
      from private.ei_local_network_areas_covering_geom(extensions.st_centroid(cleaned.geom)) as area
      limit 1
    ) as local_cover on true
    left join lateral (
      select area.name
      from private.ei_nup_planning_areas_covering_geom(extensions.st_centroid(cleaned.geom)) as area
      limit 1
    ) as nup_cover on true
    left join lateral (
      select
        sum(s.mean_slope_deg * extensions.st_area(extensions.st_intersection(s.geom, cleaned.geom)::extensions.geography))
          / nullif(sum(extensions.st_area(extensions.st_intersection(s.geom, cleaned.geom)::extensions.geography)), 0) as mean_slope_deg,
        sum(s.median_slope_deg * extensions.st_area(extensions.st_intersection(s.geom, cleaned.geom)::extensions.geography))
          / nullif(sum(extensions.st_area(extensions.st_intersection(s.geom, cleaned.geom)::extensions.geography)), 0) as median_slope_deg,
        sum(s.p90_slope_deg * extensions.st_area(extensions.st_intersection(s.geom, cleaned.geom)::extensions.geography))
          / nullif(sum(extensions.st_area(extensions.st_intersection(s.geom, cleaned.geom)::extensions.geography)), 0) as p90_slope_deg,
        sum(
          case
            when v_search.max_slope_degrees is not null and v_search.max_slope_degrees <= 5 then s.pct_le_5
            when v_search.max_slope_degrees is not null and v_search.max_slope_degrees <= 8 then s.pct_le_8
            else s.pct_le_12
          end * extensions.st_area(extensions.st_intersection(s.geom, cleaned.geom)::extensions.geography)
        ) / nullif(sum(extensions.st_area(extensions.st_intersection(s.geom, cleaned.geom)::extensions.geography)), 0) as pct_below_slope
      from public.official_physical_summaries as s
      where v_terrain_available
        and s.summary_class = 'terrain'
        and s.geom operator(extensions.&&) cleaned.geom
        and extensions.st_intersects(s.geom, cleaned.geom)
    ) as terr on true
    left join lateral (
      select jsonb_object_agg(land_cover_group, pct) as land_cover
      from (
        select
          s.land_cover_group,
          100.0 * sum(extensions.st_area(extensions.st_intersection(s.geom, cleaned.geom)::extensions.geography))
            / nullif(extensions.st_area(cleaned.geom::extensions.geography), 0) as pct
        from public.official_physical_summaries as s
        where v_land_cover_available
          and s.summary_class = 'land_cover'
          and s.land_cover_group is not null
          and s.geom operator(extensions.&&) cleaned.geom
          and extensions.st_intersects(s.geom, cleaned.geom)
        group by s.land_cover_group
      ) as grouped
    ) as lc on true
    left join lateral (
      select
        extensions.st_distance(cleaned.geom::extensions.geography, t.geom::extensions.geography) as road_distance_m,
        t.road_class
      from public.official_transport_features as t
      where v_road_available
        and t.feature_class = 'road_link'
      order by cleaned.geom operator(extensions.<->) t.geom
      limit 1
    ) as road on true
  ) as frag;

  get diagnostics v_evaluated = row_count;

  update public.opportunity_search_runs
  set
    status = 'ranking',
    evaluated_count = v_evaluated,
    change_summary = case
      when v_prev is null then null
      else format(
        'Previous completed run returned %s candidate areas. This run generated %s contiguous areas before ranking.',
        coalesce(v_prev_returned, 0),
        v_evaluated
      )
    end,
    duration_ms = greatest(1, floor(extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer)
  where id = v_run_id;

  update public.opportunity_searches
  set latest_run_id = v_run_id
  where id = v_search.id;

  run_id := v_run_id;
  status := 'ranking';
  evaluated_count := v_evaluated;
  warning_count := jsonb_array_length(v_warnings);
  return next;
end;
$$;

comment on function public.execute_opportunity_screening_run(uuid) is
  'Generates contiguous Candidate Areas for an org-scoped opportunity search. Analysis cells are internal. Covering geography is not available capacity.';

create or replace function public.save_opportunity_from_run_candidate(p_candidate_id uuid)
returns table (opportunity_id uuid, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_role text;
  v_cand public.opportunity_run_candidates%rowtype;
  v_search public.opportunity_searches%rowtype;
  v_run public.opportunity_search_runs%rowtype;
  v_id uuid;
  v_slug text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_cand
  from public.opportunity_run_candidates
  where id = p_candidate_id;

  if v_cand.id is null then
    raise exception 'Candidate not found' using errcode = '22023';
  end if;

  if v_cand.saved_opportunity_id is not null then
    select o.id, o.slug into v_id, v_slug
    from public.development_opportunities as o
    where o.id = v_cand.saved_opportunity_id;
    opportunity_id := v_id;
    slug := v_slug;
    return next;
    return;
  end if;

  select m.role into v_role
  from public.organization_members as m
  where m.profile_id = v_user_id
    and m.organization_id = v_cand.organization_id;

  if v_role is null or v_role not in ('owner', 'admin', 'member') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into v_search from public.opportunity_searches where id = v_cand.search_id;
  select * into v_run from public.opportunity_search_runs where id = v_cand.run_id;

  select opportunity_id, slug
    into v_id, v_slug
  from public.create_development_opportunity(
    v_cand.organization_id,
    coalesce(v_search.name, v_cand.name) || ' · ' || v_cand.name,
    coalesce(v_search.technology, 'battery_storage'),
    coalesce(v_search.country, 'SE'),
    v_search.region,
    v_search.municipality,
    v_cand.latitude,
    v_cand.longitude,
    v_search.target_mw,
    v_search.target_mwh,
    v_cand.usable_area_ha,
    v_search.notes,
    v_cand.search_id,
    v_cand.recommendation,
    v_cand.recommendation_summary,
    v_cand.data_confidence,
    case
      when v_cand.recommendation = 'prioritise' then 'strong_candidate'
      when v_cand.recommendation = 'investigate' then 'screening'
      else 'identified'
    end
  );

  update public.development_opportunities
  set
    originating_run_id = v_cand.run_id,
    originating_candidate_id = v_cand.id,
    area_geom = v_cand.geom,
    usable_area_ha = v_cand.usable_area_ha,
    gross_area_ha = v_cand.gross_area_ha,
    contiguous_area_ha = v_cand.contiguous_area_ha,
    exclusion_breakdown = v_cand.exclusion_breakdown,
    screening_snapshot = jsonb_build_object(
      'candidateId', v_cand.id,
      'runId', v_cand.run_id,
      'searchId', v_cand.search_id,
      'rankingVersion', coalesce(v_cand.ranking_version, v_run.ranking_version, 'suitability-v2'),
      'methodologyVersion', v_run.methodology_version,
      'sourceVersions', coalesce(v_run.source_versions, '{}'::jsonb),
      'providerAvailability', coalesce(v_run.provider_availability, '{}'::jsonb),
      'criteria', coalesce(v_run.criteria, v_search.criteria, '{}'::jsonb),
      'screening', v_cand.screening,
      'exclusionBreakdown', v_cand.exclusion_breakdown,
      'contiguousAreaHa', v_cand.contiguous_area_ha,
      'usableAreaHa', v_cand.usable_area_ha,
      'grossAreaHa', v_cand.gross_area_ha,
      'recommendation', v_cand.recommendation,
      'dataConfidence', v_cand.data_confidence,
      'rank', v_cand.rank,
      'generatedAt', v_cand.created_at
    ),
    key_positive = v_cand.key_positive,
    key_risk = v_cand.key_risk,
    updated_at = now()
  where id = v_id
    and organization_id = v_cand.organization_id;

  update public.opportunity_run_candidates
  set saved_opportunity_id = v_id
  where id = v_cand.id;

  insert into public.opportunity_events (opportunity_id, organization_id, title, detail, source)
  values (
    v_id,
    v_cand.organization_id,
    'Saved from screening run',
    'Candidate area snapshot was saved as an opportunity. Later source refreshes do not rewrite this snapshot. This is not a land parcel and is not a connection finding.',
    'NOXHEIM Analysis'
  );

  opportunity_id := v_id;
  slug := v_slug;
  return next;
end;
$$;

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
        'candidateKind', c.candidate_kind
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


