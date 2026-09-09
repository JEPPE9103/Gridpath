-- Swedish opportunity screening: official protected/Natura layers, search runs,
-- screening-cell candidates. Additive. Does not estimate available capacity.

-- ---------------------------------------------------------------------------
-- Official geographic reference features (global catalog, like grid_areas)
-- ---------------------------------------------------------------------------
create table public.official_geographic_features (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.grid_sources (id) on delete cascade,
  snapshot_id uuid references public.source_snapshots (id) on delete set null,
  feature_class text not null,
  external_id text not null,
  name text,
  designation text,
  municipality text,
  county text,
  area_ha numeric,
  geom extensions.geometry(MultiPolygon, 4326) not null,
  properties jsonb not null default '{}'::jsonb,
  source_version text,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint official_geographic_features_class_check check (
    feature_class in ('protected_area', 'natura_2000')
  ),
  constraint official_geographic_features_external_id_not_blank check (
    char_length(trim(external_id)) > 0
  ),
  constraint official_geographic_features_source_external_key unique (source_id, external_id)
);

create index official_geographic_features_geom_idx
  on public.official_geographic_features using gist (geom);

create index official_geographic_features_class_idx
  on public.official_geographic_features (feature_class);

create trigger official_geographic_features_set_updated_at
  before update on public.official_geographic_features
  for each row execute function public.set_updated_at();

comment on table public.official_geographic_features is
  'Official Swedish geographic reference features for screening. Not cadastral parcels. Not connection capacity.';

alter table public.official_geographic_features enable row level security;
alter table public.official_geographic_features force row level security;

revoke all on table public.official_geographic_features from public, anon;
grant select on table public.official_geographic_features to authenticated;

create policy official_geographic_features_select_authenticated
  on public.official_geographic_features
  for select
  to authenticated
  using ((select auth.uid()) is not null);

insert into public.grid_sources (
  name, slug, source_type, publisher, base_url, country_code, active, authority_level, update_frequency, refresh_interval_hours
) values (
  'Naturvårdsverket — Naturvårdsregistret protected areas',
  'nv-protected-areas',
  'gis',
  'Naturvårdsverket',
  'https://geodata.naturvardsverket.se/naturvardsregistret/wfs',
  'SE',
  true,
  'official',
  'as_published',
  168
), (
  'Naturvårdsverket — Natura 2000',
  'nv-natura-2000',
  'gis',
  'Naturvårdsverket',
  'https://geodata.naturvardsverket.se/n2000/wfs',
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
  authority_level = 'official',
  refresh_interval_hours = coalesce(public.grid_sources.refresh_interval_hours, 168);

-- ---------------------------------------------------------------------------
-- Search definition geography
-- ---------------------------------------------------------------------------
alter table public.opportunity_searches
  add column if not exists electricity_area text,
  add column if not exists west double precision,
  add column if not exists south double precision,
  add column if not exists east double precision,
  add column if not exists north double precision,
  add column if not exists cell_size_m numeric,
  add column if not exists latest_run_id uuid;

alter table public.opportunity_searches
  drop constraint if exists opportunity_searches_electricity_area_check;

alter table public.opportunity_searches
  add constraint opportunity_searches_electricity_area_check
  check (electricity_area is null or electricity_area in ('SE1', 'SE2', 'SE3', 'SE4'));

alter table public.opportunity_searches
  drop constraint if exists opportunity_searches_bbox_check;

alter table public.opportunity_searches
  add constraint opportunity_searches_bbox_check
  check (
    (west is null and south is null and east is null and north is null)
    or (
      west is not null and south is not null and east is not null and north is not null
      and west < east and south < north
    )
  );

-- ---------------------------------------------------------------------------
-- Search executions and screening-cell candidates
-- ---------------------------------------------------------------------------
create table public.opportunity_search_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  search_id uuid not null references public.opportunity_searches (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  previous_run_id uuid references public.opportunity_search_runs (id) on delete set null,
  status text not null default 'preparing',
  criteria jsonb not null default '{}'::jsonb,
  provider_availability jsonb not null default '{}'::jsonb,
  source_versions jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  methodology text,
  cell_size_m numeric,
  west double precision,
  south double precision,
  east double precision,
  north double precision,
  evaluated_count integer not null default 0,
  excluded_count integer not null default 0,
  returned_count integer not null default 0,
  duration_ms integer,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint opportunity_search_runs_status_check check (
    status in (
      'preparing', 'generating_cells', 'evaluating_layers', 'ranking',
      'completed', 'failed'
    )
  )
);

create index opportunity_search_runs_search_started_idx
  on public.opportunity_search_runs (search_id, started_at desc);

create table public.opportunity_run_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  run_id uuid not null references public.opportunity_search_runs (id) on delete cascade,
  search_id uuid not null references public.opportunity_searches (id) on delete cascade,
  saved_opportunity_id uuid references public.development_opportunities (id) on delete set null,
  cell_index integer not null,
  name text not null,
  rank integer,
  recommendation text not null default 'insufficient_evidence',
  recommendation_summary text,
  data_confidence text not null default 'unknown',
  excluded boolean not null default false,
  exclusion_reason text,
  latitude double precision,
  longitude double precision,
  geom extensions.geometry(MultiPolygon, 4326) not null,
  centroid extensions.geometry(Point, 4326),
  gross_area_ha numeric,
  excluded_area_ha numeric,
  usable_area_ha numeric,
  protected_overlap_pct numeric,
  natura_overlap_pct numeric,
  protected_names text[] not null default '{}',
  natura_names text[] not null default '{}',
  local_covering_name text,
  nup_covering_name text,
  covering_queried boolean not null default false,
  protected_queried boolean not null default false,
  natura_queried boolean not null default false,
  key_positive text,
  key_risk text,
  screening jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint opportunity_run_candidates_run_cell_key unique (run_id, cell_index),
  constraint opportunity_run_candidates_recommendation_check check (
    recommendation in (
      'prioritise', 'investigate', 'secondary', 'low_priority', 'insufficient_evidence'
    )
  ),
  constraint opportunity_run_candidates_confidence_check check (
    data_confidence in ('high', 'medium', 'low', 'unknown')
  )
);

create index opportunity_run_candidates_run_rank_idx
  on public.opportunity_run_candidates (run_id, rank);

create index opportunity_run_candidates_geom_idx
  on public.opportunity_run_candidates using gist (geom);

alter table public.development_opportunities
  add column if not exists originating_run_id uuid references public.opportunity_search_runs (id) on delete set null,
  add column if not exists originating_candidate_id uuid references public.opportunity_run_candidates (id) on delete set null,
  add column if not exists area_geom extensions.geometry(MultiPolygon, 4326),
  add column if not exists usable_area_ha numeric,
  add column if not exists gross_area_ha numeric;

create unique index if not exists development_opportunities_originating_candidate_key
  on public.development_opportunities (originating_candidate_id)
  where originating_candidate_id is not null;

create index if not exists development_opportunities_area_geom_idx
  on public.development_opportunities using gist (area_geom)
  where area_geom is not null;

alter table public.opportunity_searches
  drop constraint if exists opportunity_searches_latest_run_fk;

alter table public.opportunity_searches
  add constraint opportunity_searches_latest_run_fk
  foreign key (latest_run_id) references public.opportunity_search_runs (id) on delete set null;

alter table public.opportunity_search_runs enable row level security;
alter table public.opportunity_search_runs force row level security;
alter table public.opportunity_run_candidates enable row level security;
alter table public.opportunity_run_candidates force row level security;

revoke all on table public.opportunity_search_runs from public, anon;
revoke all on table public.opportunity_run_candidates from public, anon;
grant select, insert, update, delete on table public.opportunity_search_runs to authenticated;
grant select, insert, update, delete on table public.opportunity_run_candidates to authenticated;

create policy opportunity_search_runs_select_authenticated
  on public.opportunity_search_runs for select to authenticated
  using (private.belongs_to_organization(organization_id));

create policy opportunity_search_runs_insert_authenticated
  on public.opportunity_search_runs for insert to authenticated
  with check (private.can_write_organization(organization_id));

create policy opportunity_search_runs_update_authenticated
  on public.opportunity_search_runs for update to authenticated
  using (private.can_write_organization(organization_id))
  with check (private.can_write_organization(organization_id));

create policy opportunity_search_runs_delete_authenticated
  on public.opportunity_search_runs for delete to authenticated
  using (private.is_organization_admin(organization_id));

create policy opportunity_run_candidates_select_authenticated
  on public.opportunity_run_candidates for select to authenticated
  using (private.belongs_to_organization(organization_id));

create policy opportunity_run_candidates_insert_authenticated
  on public.opportunity_run_candidates for insert to authenticated
  with check (private.can_write_organization(organization_id));

create policy opportunity_run_candidates_update_authenticated
  on public.opportunity_run_candidates for update to authenticated
  using (private.can_write_organization(organization_id))
  with check (private.can_write_organization(organization_id));

create policy opportunity_run_candidates_delete_authenticated
  on public.opportunity_run_candidates for delete to authenticated
  using (private.is_organization_admin(organization_id));

-- ---------------------------------------------------------------------------
-- Source health: include Naturvårdsverket layers
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
      'nv-natura-2000'
    )
  order by gs.name;
$$;

revoke all on function public.list_source_health() from public, anon;
grant execute on function public.list_source_health() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Screening-cell generation
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
  v_warnings jsonb := '[]'::jsonb;
  v_started timestamptz := clock_timestamp();
  v_evaluated integer := 0;
begin
  perform set_config('statement_timeout', '45000', true);

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
  if v_search.electricity_area is not null then
    v_warnings := v_warnings || jsonb_build_array(
      format(
        'Electricity area %s is recorded as search intent. Official reusable bidding-zone geometry is not integrated, so it was not used as a spatial filter.',
        v_search.electricity_area
      )
    );
  end if;
  v_warnings := v_warnings || jsonb_build_array(
    'Results are screening / candidate areas, not land parcels. Proximity to electricity infrastructure and available connection capacity are not supported.'
  );

  select r.id into v_prev
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
      'minDistanceResidentialM', v_search.min_distance_residential_m
    ),
    jsonb_build_object(
      'nv-protected-areas', v_protected_available,
      'nv-natura-2000', v_natura_available,
      'ei-official-covering', true,
      'terrain', false,
      'land-cover', false,
      'grid-infrastructure', false
    ),
    jsonb_build_object(
      'nv-protected-areas', (
        select ss.content_hash
        from public.source_snapshots as ss
        inner join public.grid_sources as gs on gs.id = ss.source_id
        where gs.slug = 'nv-protected-areas'
          and ss.status in ('success', 'unchanged')
        order by ss.retrieved_at desc
        limit 1
      ),
      'nv-natura-2000', (
        select ss.content_hash
        from public.source_snapshots as ss
        inner join public.grid_sources as gs on gs.id = ss.source_id
        where gs.slug = 'nv-natura-2000'
          and ss.status in ('success', 'unchanged')
        order by ss.retrieved_at desc
        limit 1
      ),
      'ei-network-area-concessions', (
        select ss.content_hash
        from public.source_snapshots as ss
        inner join public.grid_sources as gs on gs.id = ss.source_id
        where gs.slug = 'ei-network-area-concessions'
          and ss.status in ('success', 'unchanged')
        order by ss.retrieved_at desc
        limit 1
      ),
      'ei-network-development-plans', (
        select ss.content_hash
        from public.source_snapshots as ss
        inner join public.grid_sources as gs on gs.id = ss.source_id
        where gs.slug = 'ei-network-development-plans'
          and ss.status in ('success', 'unchanged')
        order by ss.retrieved_at desc
        limit 1
      )
    ),
    v_warnings,
    'Bounded Swedish geography divided into square screening cells in EPSG:3006. Cells are candidate areas, not parcels. Adjacent cells are not merged. Hard exclusions use ingested Naturvårdsverket layers when available. Grid context is Ei covering geography at the cell centroid and is not available capacity.',
    v_cell_m,
    v_west, v_south, v_east, v_north
  )
  returning id into v_run_id;

  insert into public.opportunity_run_candidates (
    organization_id,
    run_id,
    search_id,
    cell_index,
    name,
    latitude,
    longitude,
    geom,
    centroid,
    gross_area_ha,
    excluded_area_ha,
    usable_area_ha,
    protected_overlap_pct,
    natura_overlap_pct,
    protected_names,
    natura_names,
    local_covering_name,
    nup_covering_name,
    covering_queried,
    protected_queried,
    natura_queried
  )
  select
    v_search.organization_id,
    v_run_id,
    v_search.id,
    cell.cell_index,
    format('Screening area %s', cell.cell_index),
    extensions.st_y(cell.centroid),
    extensions.st_x(cell.centroid),
    cell.geom,
    cell.centroid,
    cell.gross_ha,
    greatest(cell.gross_ha - cell.usable_ha, 0),
    cell.usable_ha,
    cell.protected_pct,
    cell.natura_pct,
    cell.protected_names,
    cell.natura_names,
    cell.local_name,
    cell.nup_name,
    true,
    v_protected_available,
    v_natura_available
  from (
    select
      row_number() over (order by gx.i, gy.j) as cell_index,
      clipped.geom,
      clipped.centroid,
      clipped.gross_ha,
      coalesce(prot.overlap_pct, 0) as protected_pct,
      coalesce(nat.overlap_pct, 0) as natura_pct,
      coalesce(prot.names, '{}'::text[]) as protected_names,
      coalesce(nat.names, '{}'::text[]) as natura_names,
      local_cover.name as local_name,
      nup_cover.name as nup_name,
      greatest(
        0,
        clipped.gross_ha * (
          1 - least(
            1,
            (
              case
                when v_search.exclude_protected and v_search.exclude_natura then coalesce(excl.overlap_pct, 0)
                when v_search.exclude_protected then coalesce(prot.overlap_pct, 0)
                when v_search.exclude_natura then coalesce(nat.overlap_pct, 0)
                else 0
              end
            ) / 100.0
          )
        )
      ) as usable_ha
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
      select
        extensions.st_multi(
          extensions.st_collectionextract(
            extensions.st_makevalid(extensions.st_intersection(raw.cell_3006, v_bbox_3006)),
            3
          )
        ) as cell_3006
    ) as piece
    cross join lateral (
      select
        extensions.st_transform(piece.cell_3006, 4326) as geom,
        extensions.st_centroid(extensions.st_transform(piece.cell_3006, 4326)) as centroid,
        extensions.st_area(extensions.st_transform(piece.cell_3006, 4326)::extensions.geography) / 10000.0 as gross_ha
    ) as clipped
    left join lateral (
      select
        case when count(*) = 0 then 0
        else 100.0 * extensions.st_area(
          extensions.st_intersection(
            clipped.geom,
            extensions.st_union(extensions.st_collect(f.geom))
          )::extensions.geography
        ) / nullif(extensions.st_area(clipped.geom::extensions.geography), 0)
        end as overlap_pct,
        coalesce(
          (array_agg(f.name order by extensions.st_area(
            extensions.st_intersection(clipped.geom, f.geom)::extensions.geography
          ) desc) filter (where f.name is not null))[1:3],
          '{}'::text[]
        ) as names
      from public.official_geographic_features as f
      where v_protected_available
        and f.feature_class = 'protected_area'
        and f.geom operator(extensions.&&) clipped.geom
        and extensions.st_intersects(f.geom, clipped.geom)
    ) as prot on true
    left join lateral (
      select
        case when count(*) = 0 then 0
        else 100.0 * extensions.st_area(
          extensions.st_intersection(
            clipped.geom,
            extensions.st_union(extensions.st_collect(f.geom))
          )::extensions.geography
        ) / nullif(extensions.st_area(clipped.geom::extensions.geography), 0)
        end as overlap_pct,
        coalesce(
          (array_agg(f.name order by extensions.st_area(
            extensions.st_intersection(clipped.geom, f.geom)::extensions.geography
          ) desc) filter (where f.name is not null))[1:3],
          '{}'::text[]
        ) as names
      from public.official_geographic_features as f
      where v_natura_available
        and f.feature_class = 'natura_2000'
        and f.geom operator(extensions.&&) clipped.geom
        and extensions.st_intersects(f.geom, clipped.geom)
    ) as nat on true
    left join lateral (
      select
        case when count(*) = 0 then 0
        else 100.0 * extensions.st_area(
          extensions.st_intersection(
            clipped.geom,
            extensions.st_union(extensions.st_collect(f.geom))
          )::extensions.geography
        ) / nullif(extensions.st_area(clipped.geom::extensions.geography), 0)
        end as overlap_pct
      from public.official_geographic_features as f
      where (v_search.exclude_protected or v_search.exclude_natura)
        and (
          (v_search.exclude_protected and f.feature_class = 'protected_area')
          or (v_search.exclude_natura and f.feature_class = 'natura_2000')
        )
        and f.geom operator(extensions.&&) clipped.geom
        and extensions.st_intersects(f.geom, clipped.geom)
    ) as excl on true
    left join lateral (
      select area.name
      from private.ei_local_network_areas_covering_geom(clipped.centroid) as area
      limit 1
    ) as local_cover on true
    left join lateral (
      select area.name
      from private.ei_nup_planning_areas_covering_geom(clipped.centroid) as area
      limit 1
    ) as nup_cover on true
    where not extensions.st_isempty(piece.cell_3006)
      and clipped.gross_ha >= 1
  ) as cell;

  get diagnostics v_evaluated = row_count;

  update public.opportunity_search_runs
  set
    status = 'ranking',
    evaluated_count = v_evaluated,
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
  'Generates screening-cell candidates for an org-scoped opportunity search. Cells are not parcels. Covering geography is not available capacity.';

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
      screening = coalesce(v_row -> 'screening', screening)
    where id = (v_row ->> 'id')::uuid
      and run_id = p_run_id
      and organization_id = v_run.organization_id;
  end loop;

  select
    count(*) filter (where c.excluded),
    count(*) filter (where not c.excluded)
  into v_excluded, v_returned
  from public.opportunity_run_candidates as c
  where c.run_id = p_run_id;

  update public.opportunity_search_runs
  set
    status = 'completed',
    excluded_count = v_excluded,
    returned_count = v_returned,
    completed_at = now()
  where id = p_run_id;

  return p_run_id;
end;
$$;

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

  select * into v_search
  from public.opportunity_searches
  where id = v_cand.search_id;

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
    'Candidate area was saved as an opportunity. This is not a land parcel and is not a connection finding.',
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
      'geometry', extensions.st_asgeojson(c.geom)::jsonb,
      'properties', jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'rank', c.rank,
        'recommendation', c.recommendation,
        'excluded', c.excluded,
        'usableAreaHa', c.usable_area_ha,
        'grossAreaHa', c.gross_area_ha,
        'dataConfidence', c.data_confidence,
        'keyPositive', c.key_positive,
        'keyRisk', c.key_risk
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

revoke all on function public.execute_opportunity_screening_run(uuid) from public, anon;
revoke all on function public.apply_opportunity_run_assessments(uuid, jsonb) from public, anon;
revoke all on function public.save_opportunity_from_run_candidate(uuid) from public, anon;
revoke all on function public.get_opportunity_run_geojson(uuid) from public, anon;

grant execute on function public.execute_opportunity_screening_run(uuid) to authenticated, service_role;
grant execute on function public.apply_opportunity_run_assessments(uuid, jsonb) to authenticated, service_role;
grant execute on function public.save_opportunity_from_run_candidate(uuid) to authenticated, service_role;
grant execute on function public.get_opportunity_run_geojson(uuid) to authenticated, service_role;
