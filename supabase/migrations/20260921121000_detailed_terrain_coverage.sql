
-- Coverage RPC: add detailed terrain (Lantmäteriet DTM) window status.
-- Preserves flood + ground semantics from prior migrations.

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
  v_dtm_refresh integer;
  v_dtm_count integer;
  v_dtm_fetched timestamptz;
  v_dtm_status text;
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
  select gs.refresh_interval_hours into v_dtm_refresh
  from public.grid_sources as gs where gs.slug = 'lantmateriet-dtm-1m';

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

  select count(*)::integer, min(s.created_at)
    into v_dtm_count, v_dtm_fetched
  from public.official_precision_summaries as s
  join public.grid_sources as gs on gs.id = s.source_id
  where s.summary_class = 'terrain'
    and gs.slug = 'lantmateriet-dtm-1m'
    and s.geom operator(extensions.&&) v_bbox
    and extensions.st_intersects(s.geom, v_bbox);

  if exists (
    select 1 from public.official_ingest_windows as w
    where w.source_slug = 'lantmateriet-dtm-1m'
      and w.status in ('covered', 'partial')
      and w.geom operator(extensions.&&) v_bbox
      and extensions.st_intersects(w.geom, v_bbox)
  ) and not exists (
    select 1 from public.official_ingest_windows as w
    where w.source_slug = 'lantmateriet-dtm-1m'
      and w.status in ('missing', 'running')
      and w.geom operator(extensions.&&) v_bbox
      and extensions.st_intersects(w.geom, v_bbox)
  ) then
    if exists (
      select 1 from public.official_ingest_windows as w
      where w.source_slug = 'lantmateriet-dtm-1m'
        and w.status = 'stale'
        and w.geom operator(extensions.&&) v_bbox
        and extensions.st_intersects(w.geom, v_bbox)
    ) then
      v_dtm_status := 'stale';
    elsif exists (
      select 1 from public.official_ingest_windows as w
      where w.source_slug = 'lantmateriet-dtm-1m'
        and w.status = 'partial'
        and w.geom operator(extensions.&&) v_bbox
        and extensions.st_intersects(w.geom, v_bbox)
    ) then
      v_dtm_status := 'partial';
    else
      v_dtm_status := 'covered';
    end if;
  else
    v_dtm_status := 'missing';
  end if;

  if v_dtm_status = 'covered'
    and v_dtm_fetched is not null
    and v_dtm_fetched < (now() - make_interval(hours => greatest(coalesce(v_dtm_refresh, 8760), 1) * 2))
  then
    v_dtm_status := 'stale';
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
    'detailedTerrain', jsonb_build_object(
      'status', v_dtm_status,
      'intersectingSummaries', v_dtm_count,
      'fetchedAt', v_dtm_fetched,
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
  'Coverage of official discovery layers for a Search Area bbox. Flood, ground, and detailed terrain use ingest windows. Protected/Natura/Ei/NUP are national catalog presence.';
