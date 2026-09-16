-- Planning intelligence (coverage-aware municipal detaljplan):
-- First layer: Malmö stad Gällande planer (ArcGIS REST MapServer).
-- Screening-level mapped plan boundaries — not zoning approval or permitting.

-- ---------------------------------------------------------------------------
-- Allow mapped_planning feature class
-- ---------------------------------------------------------------------------
alter table public.official_geographic_features
  drop constraint if exists official_geographic_features_class_check;

alter table public.official_geographic_features
  add constraint official_geographic_features_class_check
  check (feature_class in (
    'protected_area',
    'natura_2000',
    'mapped_flood',
    'mapped_ground',
    'mapped_contamination',
    'mapped_planning'
  ));

comment on table public.official_geographic_features is
  'Official Swedish geographic reference features for screening (protected, Natura 2000, mapped flood, mapped ground, mapped contamination, mapped planning). Not cadastral parcels. Mapped planning is municipal detailed-plan boundaries where a public machine-readable source exists — screening-level evidence, not zoning approval.';

insert into public.grid_sources (
  name, slug, source_type, publisher, base_url, country_code, active, authority_level, update_frequency, refresh_interval_hours
) values (
  'Malmö stad — Gällande detaljplaner',
  'malmo-gallande-detaljplaner',
  'gis',
  'SBK Malmö stad',
  'https://gis.malmo.se/arcgis/rest/services/SEPlan/Gallande_planer/MapServer/1',
  'SE',
  true,
  'official',
  'as_published',
  8760
)
on conflict (slug) do update
set
  name = excluded.name,
  publisher = excluded.publisher,
  base_url = excluded.base_url,
  active = true,
  authority_level = 'official',
  refresh_interval_hours = excluded.refresh_interval_hours;

-- ---------------------------------------------------------------------------
-- Candidate planning metrics
-- ---------------------------------------------------------------------------
alter table public.opportunity_run_candidates
  add column if not exists planning_queried boolean not null default false,
  add column if not exists planning_intersecting_count integer,
  add column if not exists planning_overlap_pct numeric,
  add column if not exists planning_nearest_m numeric,
  add column if not exists planning_plan_ids text[] not null default '{}'::text[],
  add column if not exists planning_plan_names text[] not null default '{}'::text[],
  add column if not exists planning_plan_statuses text[] not null default '{}'::text[],
  add column if not exists planning_municipality text,
  add column if not exists planning_provider_key text,
  add column if not exists planning_source_retrieved_at timestamptz;

comment on column public.opportunity_run_candidates.planning_queried is
  'True when Search Area municipal planning windows were evaluated (supported provider). False = UNKNOWN / unavailable. Zero intersecting with queried=true is outside mapped plan geometry in evaluated dataset, not missing evidence.';
comment on column public.opportunity_run_candidates.planning_overlap_pct is
  'Share of Candidate footprint intersecting any mapped detailed-plan polygon (0–100). Screening only — not zoning approval.';
comment on column public.opportunity_run_candidates.planning_nearest_m is
  'Nearest mapped detailed-plan polygon distance in metres (0 when intersecting).';

-- ---------------------------------------------------------------------------
-- Upsert: allow mapped_planning (polygon clip path like flood/ground)
-- ---------------------------------------------------------------------------
create or replace function public.upsert_official_geographic_features(
  p_source_slug text,
  p_snapshot_id uuid,
  p_feature_class text,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source uuid;
  v_count integer := 0;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Official geographic upserts are server-side only' using errcode = '42501';
  end if;
  if p_feature_class not in (
    'protected_area',
    'natura_2000',
    'mapped_flood',
    'mapped_ground',
    'mapped_contamination',
    'mapped_planning'
  ) then
    raise exception 'Invalid geographic feature class' using errcode = '22023';
  end if;
  select id into v_source from public.grid_sources where slug = p_source_slug;
  if v_source is null then
    raise exception 'Unknown source' using errcode = '22023';
  end if;

  insert into public.official_geographic_features (
    source_id, snapshot_id, feature_class, external_id, name, designation,
    geom, properties, source_version, fetched_at
  )
  select
    v_source,
    p_snapshot_id,
    p_feature_class,
    rec->>'id',
    nullif(rec->>'name', ''),
    nullif(rec->>'designation', ''),
    case
      when p_feature_class = 'mapped_contamination' then
        extensions.st_multi(
          extensions.st_setsrid(extensions.st_geomfromgeojson(rec->>'geom'), 4326)
        )
      when nullif(rec->>'clipWest', '') is not null
        and nullif(rec->>'clipSouth', '') is not null
        and nullif(rec->>'clipEast', '') is not null
        and nullif(rec->>'clipNorth', '') is not null
      then extensions.st_multi(
        extensions.st_collectionextract(
          extensions.st_makevalid(
            extensions.st_intersection(
              extensions.st_setsrid(extensions.st_geomfromgeojson(rec->>'geom'), 4326),
              extensions.st_setsrid(
                extensions.st_makeenvelope(
                  (rec->>'clipWest')::double precision,
                  (rec->>'clipSouth')::double precision,
                  (rec->>'clipEast')::double precision,
                  (rec->>'clipNorth')::double precision
                ),
                4326
              )
            )
          ),
          3
        )
      )
      else extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson(rec->>'geom'), 4326))
    end,
    coalesce(rec->'properties', '{}'::jsonb),
    nullif(rec->>'sourceVersion', ''),
    now()
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as rec
  where rec->>'id' is not null
    and rec->>'geom' is not null
    and (
      p_feature_class = 'mapped_contamination'
      or nullif(rec->>'clipWest', '') is null
      or not extensions.st_isempty(
        extensions.st_collectionextract(
          extensions.st_makevalid(
            extensions.st_intersection(
              extensions.st_setsrid(extensions.st_geomfromgeojson(rec->>'geom'), 4326),
              extensions.st_setsrid(
                extensions.st_makeenvelope(
                  (rec->>'clipWest')::double precision,
                  (rec->>'clipSouth')::double precision,
                  (rec->>'clipEast')::double precision,
                  (rec->>'clipNorth')::double precision
                ),
                4326
              )
            )
          ),
          3
        )
      )
    )
  on conflict (source_id, external_id) do update
  set
    snapshot_id = excluded.snapshot_id,
    name = excluded.name,
    designation = excluded.designation,
    geom = excluded.geom,
    properties = excluded.properties,
    source_version = excluded.source_version,
    fetched_at = excluded.fetched_at,
    updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.upsert_official_geographic_features(text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_official_geographic_features(text, uuid, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Apply planning metrics after site segmentation
-- ---------------------------------------------------------------------------
create or replace function public.apply_planning_to_run(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_run public.opportunity_search_runs%rowtype;
  v_search public.opportunity_searches%rowtype;
  v_role text;
  v_bbox extensions.geometry;
  v_planning_evaluated boolean;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select * into v_run from public.opportunity_search_runs where id = p_run_id;
  if not found then
    raise exception 'Run not found' using errcode = 'P0002';
  end if;

  select m.role into v_role
  from public.organization_members as m
  where m.profile_id = v_user
    and m.organization_id = v_run.organization_id;
  if v_role is null or v_role not in ('owner', 'admin', 'member') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into v_search from public.opportunity_searches where id = v_run.search_id;
  v_bbox := extensions.st_setsrid(
    extensions.st_makeenvelope(v_search.west, v_search.south, v_search.east, v_search.north),
    4326
  );

  -- Evaluated only when Malmö planning windows cover the Search Area.
  select
    exists (
      select 1
      from public.official_ingest_windows as w
      where w.source_slug = 'malmo-gallande-detaljplaner'
        and w.status in ('covered', 'partial')
        and w.geom operator(extensions.&&) v_bbox
        and extensions.st_intersects(w.geom, v_bbox)
    )
    and not exists (
      select 1
      from public.official_ingest_windows as w
      where w.source_slug = 'malmo-gallande-detaljplaner'
        and w.status in ('missing', 'running')
        and w.geom operator(extensions.&&) v_bbox
        and extensions.st_intersects(w.geom, v_bbox)
    )
  into v_planning_evaluated;

  update public.opportunity_run_candidates as c
  set
    planning_queried = coalesce(v_planning_evaluated, false),
    planning_provider_key = case
      when coalesce(v_planning_evaluated, false) then 'malmo-gallande-detaljplaner'
      else null
    end,
    planning_municipality = case
      when coalesce(v_planning_evaluated, false) then 'Malmö'
      else null
    end,
    planning_source_retrieved_at = case
      when coalesce(v_planning_evaluated, false) then now()
      else null
    end,
    planning_intersecting_count = case
      when not coalesce(v_planning_evaluated, false) then null
      else coalesce((
        select count(*)::integer
        from public.official_geographic_features as f
        where f.feature_class = 'mapped_planning'
          and f.geom operator(extensions.&&) c.geom
          and extensions.st_intersects(f.geom, c.geom)
      ), 0)
    end,
    planning_overlap_pct = case
      when not coalesce(v_planning_evaluated, false) then null
      else coalesce((
        select case when count(*) = 0 then 0
        else least(
          100.0,
          100.0 * extensions.st_area(
            extensions.st_intersection(
              c.geom,
              extensions.st_unaryunion(extensions.st_collect(f.geom))
            )::extensions.geography
          ) / nullif(extensions.st_area(c.geom::extensions.geography), 0)
        )
        end
        from public.official_geographic_features as f
        where f.feature_class = 'mapped_planning'
          and f.geom operator(extensions.&&) c.geom
          and extensions.st_intersects(f.geom, c.geom)
      ), 0)
    end,
    planning_nearest_m = case
      when not coalesce(v_planning_evaluated, false) then null
      else (
        select min(extensions.st_distance(f.geom::extensions.geography, c.geom::extensions.geography))
        from public.official_geographic_features as f
        where f.feature_class = 'mapped_planning'
          and f.geom operator(extensions.&&) extensions.st_expand(c.geom, 0.05)
      )
    end,
    planning_plan_ids = case
      when not coalesce(v_planning_evaluated, false) then '{}'::text[]
      else coalesce((
        select array_agg(distinct pid order by pid)
        from (
          select coalesce(nullif(trim(f.properties->>'planId'), ''), f.external_id) as pid
          from public.official_geographic_features as f
          where f.feature_class = 'mapped_planning'
            and f.geom operator(extensions.&&) c.geom
            and extensions.st_intersects(f.geom, c.geom)
        ) as ids
      ), '{}'::text[])
    end,
    planning_plan_names = case
      when not coalesce(v_planning_evaluated, false) then '{}'::text[]
      else coalesce((
        select array_agg(distinct n order by n)
        from (
          select coalesce(nullif(trim(f.properties->>'planName'), ''), nullif(trim(f.name), ''), 'unnamed') as n
          from public.official_geographic_features as f
          where f.feature_class = 'mapped_planning'
            and f.geom operator(extensions.&&) c.geom
            and extensions.st_intersects(f.geom, c.geom)
        ) as names
      ), '{}'::text[])
    end,
    planning_plan_statuses = case
      when not coalesce(v_planning_evaluated, false) then '{}'::text[]
      else coalesce((
        select array_agg(distinct st order by st)
        from (
          select coalesce(
            nullif(trim(f.properties->>'planStatus'), ''),
            nullif(trim(f.designation), ''),
            'Gällande'
          ) as st
          from public.official_geographic_features as f
          where f.feature_class = 'mapped_planning'
            and f.geom operator(extensions.&&) c.geom
            and extensions.st_intersects(f.geom, c.geom)
        ) as statuses
      ), '{}'::text[])
    end
  where c.run_id = p_run_id
    and c.candidate_kind = 'site';
end;
$$;

revoke all on function public.apply_planning_to_run(uuid) from public, anon;
grant execute on function public.apply_planning_to_run(uuid) to authenticated, service_role;

comment on function public.apply_planning_to_run(uuid) is
  'Sets Candidate municipal planning metrics from cached mapped_planning polygons. Zero intersecting with queried=true is outside mapped plan geometry in evaluated dataset, not missing.';

-- ---------------------------------------------------------------------------
-- Coverage RPC: add planning window status (preserve flood/ground/contamination)
-- ---------------------------------------------------------------------------
create or replace function public.get_search_area_coverage(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_bbox extensions.geometry;
  v_area_km2 numeric;
  v_nmd_count integer;
  v_nmd_fetched timestamptz;
  v_terrain_count integer;
  v_terrain_fetched timestamptz;
  v_road_count integer;
  v_road_fetched timestamptz;
  v_nmd_refresh integer;
  v_terrain_refresh integer;
  v_road_refresh integer;
  v_flood_refresh integer;
  v_flood_count integer;
  v_flood_fetched timestamptz;
  v_flood_status text;
  v_ground_refresh integer;
  v_ground_count integer;
  v_ground_fetched timestamptz;
  v_ground_status text;
  v_contamination_refresh integer;
  v_contamination_count integer;
  v_contamination_fetched timestamptz;
  v_contamination_status text;
  v_planning_refresh integer;
  v_planning_count integer;
  v_planning_fetched timestamptz;
  v_planning_status text;
  v_protected boolean;
  v_natura boolean;
  v_ei boolean;
  v_nup boolean;
  v_windows jsonb;
begin
  if p_west is null or p_south is null or p_east is null or p_north is null or p_west >= p_east or p_south >= p_north then
    raise exception 'Search coverage requires west < east and south < north' using errcode = '22023';
  end if;

  v_bbox := extensions.st_setsrid(extensions.st_makeenvelope(p_west, p_south, p_east, p_north), 4326);
  v_area_km2 := greatest(
    extensions.st_area(v_bbox::extensions.geography) / 1000000.0,
    0.01
  );

  select gs.refresh_interval_hours into v_nmd_refresh
  from public.grid_sources as gs where gs.slug = 'nv-nmd-2023';
  select gs.refresh_interval_hours into v_terrain_refresh
  from public.grid_sources as gs where gs.slug = 'copernicus-dem-glo90';
  select gs.refresh_interval_hours into v_road_refresh
  from public.grid_sources as gs where gs.slug = 'trafikverket-inspire-roadlink';
  select gs.refresh_interval_hours into v_flood_refresh
  from public.grid_sources as gs where gs.slug = 'msb-oversvamningskartering';
  select gs.refresh_interval_hours into v_ground_refresh
  from public.grid_sources as gs where gs.slug = 'sgu-jordarter-25k-100k';
  select gs.refresh_interval_hours into v_contamination_refresh
  from public.grid_sources as gs where gs.slug = 'lst-ebh-potentiellt-fororenade';
  select gs.refresh_interval_hours into v_planning_refresh
  from public.grid_sources as gs where gs.slug = 'malmo-gallande-detaljplaner';

  select count(*)::integer, min(s.fetched_at)
    into v_nmd_count, v_nmd_fetched
  from public.official_physical_summaries as s
  join public.grid_sources as gs on gs.id = s.source_id
  where s.summary_class = 'land_cover'
    and gs.slug in ('nv-nmd-2023', 'nv-nmd-2018')
    and s.geom operator(extensions.&&) v_bbox
    and extensions.st_intersects(s.geom, v_bbox);

  select count(*)::integer, min(s.fetched_at)
    into v_terrain_count, v_terrain_fetched
  from public.official_physical_summaries as s
  join public.grid_sources as gs on gs.id = s.source_id
  where s.summary_class = 'terrain'
    and gs.slug = 'copernicus-dem-glo90'
    and s.geom operator(extensions.&&) v_bbox
    and extensions.st_intersects(s.geom, v_bbox);

  select count(*)::integer, min(t.fetched_at)
    into v_road_count, v_road_fetched
  from public.official_transport_features as t
  where t.feature_class = 'road_link'
    and t.geom operator(extensions.&&) v_bbox
    and extensions.st_intersects(t.geom, v_bbox);

  select count(*)::integer, min(f.fetched_at)
    into v_flood_count, v_flood_fetched
  from public.official_geographic_features as f
  where f.feature_class = 'mapped_flood'
    and f.geom operator(extensions.&&) v_bbox
    and extensions.st_intersects(f.geom, v_bbox);

  select count(*)::integer, min(f.fetched_at)
    into v_ground_count, v_ground_fetched
  from public.official_geographic_features as f
  where f.feature_class = 'mapped_ground'
    and f.geom operator(extensions.&&) v_bbox
    and extensions.st_intersects(f.geom, v_bbox);

  select count(*)::integer, min(f.fetched_at)
    into v_contamination_count, v_contamination_fetched
  from public.official_geographic_features as f
  where f.feature_class = 'mapped_contamination'
    and f.geom operator(extensions.&&) v_bbox
    and extensions.st_intersects(f.geom, v_bbox);

  select count(*)::integer, min(f.fetched_at)
    into v_planning_count, v_planning_fetched
  from public.official_geographic_features as f
  where f.feature_class = 'mapped_planning'
    and f.geom operator(extensions.&&) v_bbox
    and extensions.st_intersects(f.geom, v_bbox);

  if exists (
    select 1 from public.official_ingest_windows as w
    where w.source_slug = 'msb-oversvamningskartering'
      and w.status in ('covered', 'partial')
      and w.geom operator(extensions.&&) v_bbox
      and extensions.st_intersects(w.geom, v_bbox)
  ) and not exists (
    select 1 from public.official_ingest_windows as w
    where w.source_slug = 'msb-oversvamningskartering'
      and w.status in ('missing', 'running')
      and w.geom operator(extensions.&&) v_bbox
      and extensions.st_intersects(w.geom, v_bbox)
  ) then
    if exists (
      select 1 from public.official_ingest_windows as w
      where w.source_slug = 'msb-oversvamningskartering'
        and w.status = 'stale'
        and w.geom operator(extensions.&&) v_bbox
        and extensions.st_intersects(w.geom, v_bbox)
    ) then
      v_flood_status := 'stale';
    elsif exists (
      select 1 from public.official_ingest_windows as w
      where w.source_slug = 'msb-oversvamningskartering'
        and w.status = 'partial'
        and w.geom operator(extensions.&&) v_bbox
        and extensions.st_intersects(w.geom, v_bbox)
    ) then
      v_flood_status := 'partial';
    else
      v_flood_status := 'covered';
    end if;
  else
    v_flood_status := 'missing';
  end if;

  if v_flood_status = 'covered'
    and v_flood_fetched is not null
    and v_flood_fetched < (now() - make_interval(hours => greatest(coalesce(v_flood_refresh, 8760), 1) * 2))
  then
    v_flood_status := 'stale';
  end if;

  if exists (
    select 1 from public.official_ingest_windows as w
    where w.source_slug = 'sgu-jordarter-25k-100k'
      and w.status in ('covered', 'partial')
      and w.geom operator(extensions.&&) v_bbox
      and extensions.st_intersects(w.geom, v_bbox)
  ) and not exists (
    select 1 from public.official_ingest_windows as w
    where w.source_slug = 'sgu-jordarter-25k-100k'
      and w.status in ('missing', 'running')
      and w.geom operator(extensions.&&) v_bbox
      and extensions.st_intersects(w.geom, v_bbox)
  ) then
    if exists (
      select 1 from public.official_ingest_windows as w
      where w.source_slug = 'sgu-jordarter-25k-100k'
        and w.status = 'stale'
        and w.geom operator(extensions.&&) v_bbox
        and extensions.st_intersects(w.geom, v_bbox)
    ) then
      v_ground_status := 'stale';
    elsif exists (
      select 1 from public.official_ingest_windows as w
      where w.source_slug = 'sgu-jordarter-25k-100k'
        and w.status = 'partial'
        and w.geom operator(extensions.&&) v_bbox
        and extensions.st_intersects(w.geom, v_bbox)
    ) then
      v_ground_status := 'partial';
    else
      v_ground_status := 'covered';
    end if;
  else
    v_ground_status := 'missing';
  end if;

  if v_ground_status = 'covered'
    and v_ground_fetched is not null
    and v_ground_fetched < (now() - make_interval(hours => greatest(coalesce(v_ground_refresh, 8760), 1) * 2))
  then
    v_ground_status := 'stale';
  end if;

  if exists (
    select 1 from public.official_ingest_windows as w
    where w.source_slug = 'lst-ebh-potentiellt-fororenade'
      and w.status in ('covered', 'partial')
      and w.geom operator(extensions.&&) v_bbox
      and extensions.st_intersects(w.geom, v_bbox)
  ) and not exists (
    select 1 from public.official_ingest_windows as w
    where w.source_slug = 'lst-ebh-potentiellt-fororenade'
      and w.status in ('missing', 'running')
      and w.geom operator(extensions.&&) v_bbox
      and extensions.st_intersects(w.geom, v_bbox)
  ) then
    if exists (
      select 1 from public.official_ingest_windows as w
      where w.source_slug = 'lst-ebh-potentiellt-fororenade'
        and w.status = 'stale'
        and w.geom operator(extensions.&&) v_bbox
        and extensions.st_intersects(w.geom, v_bbox)
    ) then
      v_contamination_status := 'stale';
    elsif exists (
      select 1 from public.official_ingest_windows as w
      where w.source_slug = 'lst-ebh-potentiellt-fororenade'
        and w.status = 'partial'
        and w.geom operator(extensions.&&) v_bbox
        and extensions.st_intersects(w.geom, v_bbox)
    ) then
      v_contamination_status := 'partial';
    else
      v_contamination_status := 'covered';
    end if;
  else
    v_contamination_status := 'missing';
  end if;

  if v_contamination_status = 'covered'
    and v_contamination_fetched is not null
    and v_contamination_fetched < (now() - make_interval(hours => greatest(coalesce(v_contamination_refresh, 8760), 1) * 2))
  then
    v_contamination_status := 'stale';
  end if;

  -- Planning: covered when Malmö windows exist; missing when no supported provider / no windows
  -- (UI treats missing as unavailable for non-Malmö Search Areas).
  if exists (
    select 1 from public.official_ingest_windows as w
    where w.source_slug = 'malmo-gallande-detaljplaner'
      and w.status in ('covered', 'partial')
      and w.geom operator(extensions.&&) v_bbox
      and extensions.st_intersects(w.geom, v_bbox)
  ) and not exists (
    select 1 from public.official_ingest_windows as w
    where w.source_slug = 'malmo-gallande-detaljplaner'
      and w.status in ('missing', 'running')
      and w.geom operator(extensions.&&) v_bbox
      and extensions.st_intersects(w.geom, v_bbox)
  ) then
    if exists (
      select 1 from public.official_ingest_windows as w
      where w.source_slug = 'malmo-gallande-detaljplaner'
        and w.status = 'stale'
        and w.geom operator(extensions.&&) v_bbox
        and extensions.st_intersects(w.geom, v_bbox)
    ) then
      v_planning_status := 'stale';
    elsif exists (
      select 1 from public.official_ingest_windows as w
      where w.source_slug = 'malmo-gallande-detaljplaner'
        and w.status = 'partial'
        and w.geom operator(extensions.&&) v_bbox
        and extensions.st_intersects(w.geom, v_bbox)
    ) then
      v_planning_status := 'partial';
    else
      v_planning_status := 'covered';
    end if;
  else
    v_planning_status := 'missing';
  end if;

  if v_planning_status = 'covered'
    and v_planning_fetched is not null
    and v_planning_fetched < (now() - make_interval(hours => greatest(coalesce(v_planning_refresh, 8760), 1) * 2))
  then
    v_planning_status := 'stale';
  end if;

  select exists (
    select 1 from public.official_geographic_features as f
    where f.feature_class = 'protected_area'
  ) into v_protected;

  select exists (
    select 1 from public.official_geographic_features as f
    where f.feature_class = 'natura_2000'
  ) into v_natura;

  select exists (
    select 1 from public.grid_areas as a
    join public.grid_sources as gs on gs.id = a.source_id
    where gs.slug = 'ei-network-area-concessions'
      and a.country_code = 'SE'
  ) into v_ei;

  select exists (
    select 1 from public.grid_areas as a
    join public.grid_sources as gs on gs.id = a.source_id
    where gs.slug = 'ei-network-development-plans'
      and a.country_code = 'SE'
  ) into v_nup;

  select coalesce(jsonb_agg(jsonb_build_object(
    'sourceSlug', w.source_slug,
    'coverageKey', w.coverage_key,
    'status', w.status,
    'fetchedAt', w.fetched_at,
    'lockedUntil', w.locked_until,
    'lastError', w.last_error
  ) order by w.source_slug, w.coverage_key), '[]'::jsonb)
    into v_windows
  from public.official_ingest_windows as w
  where w.geom operator(extensions.&&) v_bbox
    and extensions.st_intersects(w.geom, v_bbox);

  return jsonb_build_object(
    'bbox', jsonb_build_object('west', p_west, 'south', p_south, 'east', p_east, 'north', p_north),
    'areaKm2', round(v_area_km2::numeric, 2),
    'nmd', jsonb_build_object(
      'status', private.evidence_coverage_status(
        least(v_nmd_count::numeric / greatest(v_area_km2, 1), 2),
        v_nmd_fetched,
        coalesce(v_nmd_refresh, 8760)
      ),
      'intersectingSummaries', v_nmd_count,
      'fetchedAt', v_nmd_fetched,
      'scope', 'bbox'
    ),
    'copernicus', jsonb_build_object(
      'status', private.evidence_coverage_status(
        least(v_terrain_count::numeric / greatest(v_area_km2, 1), 2),
        v_terrain_fetched,
        coalesce(v_terrain_refresh, 8760)
      ),
      'intersectingSummaries', v_terrain_count,
      'fetchedAt', v_terrain_fetched,
      'scope', 'bbox'
    ),
    'roadlink', jsonb_build_object(
      'status', case
        when v_road_count is null or v_road_count = 0 then 'missing'
        when v_road_fetched is not null
          and v_road_fetched < (now() - make_interval(hours => greatest(coalesce(v_road_refresh, 168), 1) * 2))
          then 'stale'
        when v_road_count >= 3 then 'covered'
        else 'partial'
      end,
      'intersectingFeatures', v_road_count,
      'fetchedAt', v_road_fetched,
      'scope', 'bbox'
    ),
    'flood', jsonb_build_object(
      'status', v_flood_status,
      'intersectingFeatures', v_flood_count,
      'fetchedAt', v_flood_fetched,
      'scope', 'bbox'
    ),
    'ground', jsonb_build_object(
      'status', v_ground_status,
      'intersectingFeatures', v_ground_count,
      'fetchedAt', v_ground_fetched,
      'scope', 'bbox'
    ),
    'contamination', jsonb_build_object(
      'status', v_contamination_status,
      'intersectingFeatures', v_contamination_count,
      'fetchedAt', v_contamination_fetched,
      'scope', 'bbox'
    ),
    'planning', jsonb_build_object(
      'status', v_planning_status,
      'intersectingFeatures', v_planning_count,
      'fetchedAt', v_planning_fetched,
      'scope', 'bbox'
    ),
    'protectedAreas', jsonb_build_object(
      'status', case when v_protected then 'covered' else 'missing' end,
      'scope', 'national_catalog'
    ),
    'natura2000', jsonb_build_object(
      'status', case when v_natura then 'covered' else 'missing' end,
      'scope', 'national_catalog'
    ),
    'eiNetworkAreas', jsonb_build_object(
      'status', case when v_ei then 'covered' else 'missing' end,
      'scope', 'national_catalog'
    ),
    'nup', jsonb_build_object(
      'status', case when v_nup then 'covered' else 'missing' end,
      'scope', 'national_catalog'
    ),
    'windows', v_windows
  );
end;
$$;

comment on function public.get_search_area_coverage(double precision, double precision, double precision, double precision) is
  'Coverage of official discovery layers for a Search Area bbox. Flood, ground, contamination and planning use ingest windows. Protected/Natura/Ei/NUP are national catalog presence.';
