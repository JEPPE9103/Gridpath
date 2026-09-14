-- Sweden-wide discovery: bbox coverage windows, on-demand ingest locks,
-- administrative place envelopes. Additive. Does not estimate capacity.
-- Does not rewrite opportunity screening_snapshot rows.

-- ---------------------------------------------------------------------------
-- Search ingest progress (tenant-owned, not official catalog)
-- ---------------------------------------------------------------------------
alter table public.opportunity_searches
  add column if not exists ingest_progress jsonb not null default '{}'::jsonb;

comment on column public.opportunity_searches.ingest_progress is
  'Server-written discovery ingest stages for the Search Area. Never a fake percentage. Not a screening_snapshot.';

-- ---------------------------------------------------------------------------
-- Official ingest windows (coverage + lock, not raw rasters/roads)
-- ---------------------------------------------------------------------------
create table if not exists public.official_ingest_windows (
  id uuid primary key default gen_random_uuid(),
  source_slug text not null,
  coverage_key text not null,
  west double precision not null,
  south double precision not null,
  east double precision not null,
  north double precision not null,
  geom extensions.geometry(Polygon, 4326) not null,
  status text not null default 'missing',
  source_version text,
  snapshot_id uuid references public.source_snapshots (id) on delete set null,
  fetched_at timestamptz,
  locked_until timestamptz,
  last_error text,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint official_ingest_windows_status_check check (
    status in ('missing', 'running', 'covered', 'partial', 'failed', 'stale')
  ),
  constraint official_ingest_windows_bbox_check check (west < east and south < north),
  constraint official_ingest_windows_source_key unique (source_slug, coverage_key)
);

create index if not exists official_ingest_windows_geom_idx
  on public.official_ingest_windows using gist (geom);
create index if not exists official_ingest_windows_slug_status_idx
  on public.official_ingest_windows (source_slug, status);

create trigger official_ingest_windows_set_updated_at
  before update on public.official_ingest_windows
  for each row execute function public.set_updated_at();

comment on table public.official_ingest_windows is
  'Derived coverage tiles for on-demand official ingest. Stores window metadata and locks, not raw NMD/DTM/RoadLink payloads.';

alter table public.official_ingest_windows enable row level security;
alter table public.official_ingest_windows force row level security;
revoke all on table public.official_ingest_windows from public, anon;
grant select on table public.official_ingest_windows to authenticated;
grant select, insert, update, delete on table public.official_ingest_windows to service_role;

drop policy if exists official_ingest_windows_select_authenticated on public.official_ingest_windows;
create policy official_ingest_windows_select_authenticated
  on public.official_ingest_windows
  for select
  to authenticated
  using ((select auth.uid()) is not null);

-- ---------------------------------------------------------------------------
-- Coverage status helper
-- ---------------------------------------------------------------------------
create or replace function private.evidence_coverage_status(
  p_ratio numeric,
  p_fetched_at timestamptz,
  p_refresh_hours integer
)
returns text
language sql
immutable
as $$
  select case
    when p_ratio is null or p_ratio <= 0 then 'missing'
    when p_fetched_at is not null
      and p_refresh_hours is not null
      and p_fetched_at < (now() - make_interval(hours => greatest(p_refresh_hours, 1) * 2))
      then 'stale'
    when p_ratio >= 0.85 then 'covered'
    else 'partial'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Search-area coverage (authenticated read)
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
  'Coverage of official discovery layers for a Search Area bbox. Protected/Natura/Ei/NUP are national catalog presence. NMD, Copernicus and RoadLink are bbox intersections. Does not return raw geometries.';

revoke all on function public.get_search_area_coverage(double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.get_search_area_coverage(double precision, double precision, double precision, double precision) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Window lock claim / finish (service_role only)
-- ---------------------------------------------------------------------------
create or replace function public.claim_official_ingest_window(
  p_source_slug text,
  p_coverage_key text,
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
  p_lock_seconds integer default 900
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.official_ingest_windows%rowtype;
  v_lock integer := greatest(coalesce(p_lock_seconds, 900), 30);
  v_now timestamptz := now();
  v_geom extensions.geometry;
  v_stale_after interval;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Ingest window claims are server-side only' using errcode = '42501';
  end if;
  if p_source_slug is null or char_length(trim(p_source_slug)) = 0 or p_coverage_key is null then
    raise exception 'Coverage key required' using errcode = '22023';
  end if;
  if p_west >= p_east or p_south >= p_north then
    raise exception 'Invalid ingest window bbox' using errcode = '22023';
  end if;

  v_geom := extensions.st_setsrid(extensions.st_makeenvelope(p_west, p_south, p_east, p_north), 4326);
  v_stale_after := case
    when p_source_slug = 'trafikverket-inspire-roadlink' then interval '14 days'
    else interval '730 days'
  end;

  insert into public.official_ingest_windows (
    source_slug, coverage_key, west, south, east, north, geom, status, locked_until, last_attempt_at
  ) values (
    p_source_slug, p_coverage_key, p_west, p_south, p_east, p_north, v_geom, 'missing', null, v_now
  )
  on conflict (source_slug, coverage_key) do nothing;

  update public.official_ingest_windows
  set
    status = 'running',
    west = p_west,
    south = p_south,
    east = p_east,
    north = p_north,
    geom = v_geom,
    locked_until = v_now + make_interval(secs => v_lock),
    last_attempt_at = v_now,
    last_error = null
  where source_slug = p_source_slug
    and coverage_key = p_coverage_key
    and (
      status in ('missing', 'failed', 'stale', 'partial')
      or locked_until is null
      or locked_until <= v_now
      or (
        status = 'covered'
        and fetched_at is not null
        and fetched_at <= v_now - v_stale_after
      )
    )
  returning * into v_row;

  if found then
    return jsonb_build_object('outcome', 'acquired', 'window', to_jsonb(v_row));
  end if;

  select * into v_row
  from public.official_ingest_windows
  where source_slug = p_source_slug and coverage_key = p_coverage_key;

  if v_row.status = 'covered' then
    return jsonb_build_object('outcome', 'covered', 'window', to_jsonb(v_row));
  end if;
  return jsonb_build_object('outcome', 'waiting', 'window', to_jsonb(v_row));
end;
$$;

revoke all on function public.claim_official_ingest_window(text, text, double precision, double precision, double precision, double precision, integer) from public, anon, authenticated;
grant execute on function public.claim_official_ingest_window(text, text, double precision, double precision, double precision, double precision, integer) to service_role;

create or replace function public.finish_official_ingest_window(
  p_source_slug text,
  p_coverage_key text,
  p_status text,
  p_source_version text default null,
  p_snapshot_id uuid default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Ingest window updates are server-side only' using errcode = '42501';
  end if;
  if p_status not in ('covered', 'partial', 'failed', 'missing', 'stale') then
    raise exception 'Invalid ingest window status' using errcode = '22023';
  end if;
  update public.official_ingest_windows
  set
    status = p_status,
    source_version = coalesce(p_source_version, source_version),
    snapshot_id = coalesce(p_snapshot_id, snapshot_id),
    fetched_at = case when p_status in ('covered', 'partial') then now() else fetched_at end,
    locked_until = null,
    last_error = p_error
  where source_slug = p_source_slug
    and coverage_key = p_coverage_key;
end;
$$;

revoke all on function public.finish_official_ingest_window(text, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.finish_official_ingest_window(text, text, text, text, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Derived summary upserts (service_role)
-- ---------------------------------------------------------------------------
create or replace function public.upsert_official_physical_summaries(
  p_source_slug text,
  p_snapshot_id uuid,
  p_summary_class text,
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
    raise exception 'Official summary upserts are server-side only' using errcode = '42501';
  end if;
  if p_summary_class not in ('terrain', 'land_cover') then
    raise exception 'Invalid summary class' using errcode = '22023';
  end if;
  select id into v_source from public.grid_sources where slug = p_source_slug;
  if v_source is null then
    raise exception 'Unknown source' using errcode = '22023';
  end if;

  insert into public.official_physical_summaries (
    source_id, snapshot_id, summary_class, external_id, geom,
    mean_slope_deg, median_slope_deg, p90_slope_deg, max_slope_deg,
    pct_le_5, pct_le_8, pct_le_12, nmd_class, land_cover_group, fetched_at
  )
  select
    v_source,
    p_snapshot_id,
    p_summary_class,
    rec->>'externalId',
    case
      when rec->>'crs' = 'EPSG:3006' then
        extensions.st_transform(
          extensions.st_setsrid(
            extensions.st_makeenvelope(
              (rec->>'west')::double precision,
              (rec->>'south')::double precision,
              (rec->>'east')::double precision,
              (rec->>'north')::double precision
            ),
            3006
          ),
          4326
        )
      else
        extensions.st_setsrid(
          extensions.st_makeenvelope(
            (rec->>'west')::double precision,
            (rec->>'south')::double precision,
            (rec->>'east')::double precision,
            (rec->>'north')::double precision
          ),
          4326
        )
    end,
    nullif(rec->>'meanSlopeDeg', '')::numeric,
    nullif(rec->>'medianSlopeDeg', '')::numeric,
    nullif(rec->>'p90SlopeDeg', '')::numeric,
    nullif(rec->>'maxSlopeDeg', '')::numeric,
    nullif(rec->>'pctLe5', '')::numeric,
    nullif(rec->>'pctLe8', '')::numeric,
    nullif(rec->>'pctLe12', '')::numeric,
    nullif(rec->>'nmdClass', '')::integer,
    nullif(rec->>'landCoverGroup', ''),
    now()
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as rec
  where rec->>'externalId' is not null
  on conflict (source_id, external_id) do update
  set
    snapshot_id = excluded.snapshot_id,
    geom = excluded.geom,
    mean_slope_deg = excluded.mean_slope_deg,
    median_slope_deg = excluded.median_slope_deg,
    p90_slope_deg = excluded.p90_slope_deg,
    max_slope_deg = excluded.max_slope_deg,
    pct_le_5 = excluded.pct_le_5,
    pct_le_8 = excluded.pct_le_8,
    pct_le_12 = excluded.pct_le_12,
    nmd_class = excluded.nmd_class,
    land_cover_group = excluded.land_cover_group,
    fetched_at = excluded.fetched_at,
    updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.upsert_official_physical_summaries(text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_official_physical_summaries(text, uuid, text, jsonb) to service_role;

create or replace function public.upsert_official_transport_features(
  p_source_slug text,
  p_snapshot_id uuid,
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
    raise exception 'Official transport upserts are server-side only' using errcode = '42501';
  end if;
  select id into v_source from public.grid_sources where slug = p_source_slug;
  if v_source is null then
    raise exception 'Unknown source' using errcode = '22023';
  end if;

  insert into public.official_transport_features (
    source_id, snapshot_id, feature_class, external_id, name, road_class, geom, properties, fetched_at
  )
  select
    v_source,
    p_snapshot_id,
    'road_link',
    rec->>'id',
    nullif(rec->>'name', ''),
    nullif(rec->>'cls', ''),
    extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson(rec->>'geom'), 4326)),
    '{}'::jsonb,
    now()
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as rec
  where rec->>'id' is not null
    and rec->>'geom' is not null
  on conflict (source_id, external_id) do update
  set
    snapshot_id = excluded.snapshot_id,
    geom = excluded.geom,
    name = excluded.name,
    road_class = excluded.road_class,
    fetched_at = excluded.fetched_at,
    updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.upsert_official_transport_features(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_official_transport_features(text, uuid, jsonb) to service_role;

create or replace function public.insert_official_source_snapshot(
  p_source_slug text,
  p_content_hash text,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source uuid;
  v_id uuid;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Official snapshots are server-side only' using errcode = '42501';
  end if;
  select id into v_source from public.grid_sources where slug = p_source_slug;
  if v_source is null then
    raise exception 'Unknown source' using errcode = '22023';
  end if;
  insert into public.source_snapshots (
    source_id, retrieved_at, content_hash, raw_content, storage_path, status, metadata
  ) values (
    v_source, now(), p_content_hash, null, null, 'success', coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (source_id, content_hash) do update
  set retrieved_at = excluded.retrieved_at, status = excluded.status, metadata = excluded.metadata
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.insert_official_source_snapshot(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.insert_official_source_snapshot(text, text, jsonb) to service_role;

create or replace function public.project_bbox_to_sweref99tm(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'xmin', extensions.st_xmin(g),
    'ymin', extensions.st_ymin(g),
    'xmax', extensions.st_xmax(g),
    'ymax', extensions.st_ymax(g)
  )
  from (
    select extensions.st_transform(
      extensions.st_setsrid(extensions.st_makeenvelope(p_west, p_south, p_east, p_north), 4326),
      3006
    ) as g
  ) as transformed;
$$;

revoke all on function public.project_bbox_to_sweref99tm(double precision, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.project_bbox_to_sweref99tm(double precision, double precision, double precision, double precision) to service_role;

-- ---------------------------------------------------------------------------
-- Swedish administrative place search (envelope only, not cadastral)
-- ---------------------------------------------------------------------------
create or replace function public.search_swedish_administrative_places(p_query text)
returns table (
  area_class text,
  code text,
  name text,
  west double precision,
  south double precision,
  east double precision,
  north double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.area_class,
    a.code,
    a.name,
    extensions.st_xmin(a.geom) as west,
    extensions.st_ymin(a.geom) as south,
    extensions.st_xmax(a.geom) as east,
    extensions.st_ymax(a.geom) as north
  from public.official_administrative_areas as a
  where char_length(trim(coalesce(p_query, ''))) >= 2
    and a.name ilike '%' || trim(p_query) || '%'
  order by
    case when a.area_class = 'municipality' then 0 else 1 end,
    case when lower(a.name) = lower(trim(p_query)) then 0 else 1 end,
    a.name
  limit 8;
$$;

comment on function public.search_swedish_administrative_places(text) is
  'SCB administrative envelopes for place search. Cartographic/administrative boundary only — not cadastral and not property ownership. Never used to clip Candidate geometry.';

revoke all on function public.search_swedish_administrative_places(text) from public, anon;
grant execute on function public.search_swedish_administrative_places(text) to authenticated, service_role;
