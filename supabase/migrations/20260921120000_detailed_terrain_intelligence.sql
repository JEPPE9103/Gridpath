-- Detailed terrain intelligence: Lantmäteriet Markhöjdmodell 1 m DTM
-- into Candidate screening via on-demand precision summaries.
-- Additive. Does not rewrite opportunity screening_snapshot.
-- Does not claim earthworks design, cut/fill, or constructability.

-- ---------------------------------------------------------------------------
-- Precision summaries: elevation range
-- ---------------------------------------------------------------------------
alter table public.official_precision_summaries
  add column if not exists elev_min_m numeric,
  add column if not exists elev_max_m numeric,
  add column if not exists elev_range_m numeric;

comment on column public.official_precision_summaries.elev_range_m is
  'Elevation range (m) within the precision cell derived from official 1 m DTM. Screening-level — not a grading design.';

-- ---------------------------------------------------------------------------
-- Candidate detailed terrain metrics
-- ---------------------------------------------------------------------------
alter table public.opportunity_run_candidates
  add column if not exists detailed_terrain_queried boolean not null default false,
  add column if not exists elev_min_m numeric,
  add column if not exists elev_max_m numeric,
  add column if not exists elev_range_m numeric,
  add column if not exists pct_above_slope numeric;

comment on column public.opportunity_run_candidates.detailed_terrain_queried is
  'True when Lantmäteriet 1 m DTM precision summaries were evaluated for the Search Area. False = detailed terrain UNKNOWN.';
comment on column public.opportunity_run_candidates.elev_range_m is
  'Elevation range (m) across Candidate footprint from detailed DTM summaries. Screening-level.';
comment on column public.opportunity_run_candidates.pct_above_slope is
  'Share of Candidate footprint above the Search Area preferred slope threshold, from detailed DTM when available.';

-- ---------------------------------------------------------------------------
-- Upsert precision summaries (service_role)
-- ---------------------------------------------------------------------------
create or replace function public.upsert_official_precision_summaries(
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
    raise exception 'Official precision upserts are server-side only' using errcode = '42501';
  end if;
  if p_summary_class not in ('terrain', 'land_cover') then
    raise exception 'Invalid precision summary class' using errcode = '22023';
  end if;
  select id into v_source from public.grid_sources where slug = p_source_slug;
  if v_source is null then
    raise exception 'Unknown source' using errcode = '22023';
  end if;

  insert into public.official_precision_summaries (
    source_id, snapshot_id, summary_class, taxonomy, resolution_m, external_id, geom,
    mean_slope_deg, median_slope_deg, p90_slope_deg, max_slope_deg,
    pct_le_5, pct_le_8, pct_le_12, nmd_class, land_cover_group,
    elev_min_m, elev_max_m, elev_range_m
  )
  select
    v_source,
    p_snapshot_id,
    p_summary_class,
    nullif(rec->>'taxonomy', ''),
    coalesce((rec->>'resolutionM')::integer, 100),
    rec->>'externalId',
    extensions.st_setsrid(
      extensions.st_makeenvelope(
        (rec->>'west')::double precision,
        (rec->>'south')::double precision,
        (rec->>'east')::double precision,
        (rec->>'north')::double precision
      ),
      4326
    ),
    nullif(rec->>'meanSlopeDeg', '')::numeric,
    nullif(rec->>'medianSlopeDeg', '')::numeric,
    nullif(rec->>'p90SlopeDeg', '')::numeric,
    nullif(rec->>'maxSlopeDeg', '')::numeric,
    nullif(rec->>'pctLe5', '')::numeric,
    nullif(rec->>'pctLe8', '')::numeric,
    nullif(rec->>'pctLe12', '')::numeric,
    nullif(rec->>'nmdClass', '')::integer,
    nullif(rec->>'landCoverGroup', ''),
    nullif(rec->>'elevMinM', '')::numeric,
    nullif(rec->>'elevMaxM', '')::numeric,
    nullif(rec->>'elevRangeM', '')::numeric
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as rec
  where rec->>'externalId' is not null
    and nullif(rec->>'west', '') is not null
    and nullif(rec->>'south', '') is not null
    and nullif(rec->>'east', '') is not null
    and nullif(rec->>'north', '') is not null
  on conflict (source_id, external_id) do update
  set
    snapshot_id = excluded.snapshot_id,
    taxonomy = excluded.taxonomy,
    resolution_m = excluded.resolution_m,
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
    elev_min_m = excluded.elev_min_m,
    elev_max_m = excluded.elev_max_m,
    elev_range_m = excluded.elev_range_m;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.upsert_official_precision_summaries(text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.upsert_official_precision_summaries(text, uuid, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Apply detailed terrain after site segmentation
-- ---------------------------------------------------------------------------
create or replace function public.apply_detailed_terrain_to_run(p_run_id uuid)
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
  v_dtm_evaluated boolean;
  v_threshold numeric;
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
  v_threshold := coalesce(v_search.max_slope_degrees, 5);

  select
    exists (
      select 1
      from public.official_ingest_windows as w
      where w.source_slug = 'lantmateriet-dtm-1m'
        and w.status in ('covered', 'partial')
        and w.geom operator(extensions.&&) v_bbox
        and extensions.st_intersects(w.geom, v_bbox)
    )
    and not exists (
      select 1
      from public.official_ingest_windows as w
      where w.source_slug = 'lantmateriet-dtm-1m'
        and w.status in ('missing', 'running')
        and w.geom operator(extensions.&&) v_bbox
        and extensions.st_intersects(w.geom, v_bbox)
    )
    and exists (
      select 1
      from public.official_precision_summaries as s
      join public.grid_sources as gs on gs.id = s.source_id
      where s.summary_class = 'terrain'
        and gs.slug = 'lantmateriet-dtm-1m'
        and s.geom operator(extensions.&&) v_bbox
        and extensions.st_intersects(s.geom, v_bbox)
    )
  into v_dtm_evaluated;

  update public.opportunity_run_candidates as c
  set
    detailed_terrain_queried = coalesce(v_dtm_evaluated, false),
    terrain_provider_key = case
      when coalesce(v_dtm_evaluated, false) then 'lantmateriet-dtm-1m'
      else c.terrain_provider_key
    end,
    terrain_resolution = case
      when coalesce(v_dtm_evaluated, false) then 'detailed'
      else c.terrain_resolution
    end,
    mean_slope_deg = case
      when not coalesce(v_dtm_evaluated, false) then c.mean_slope_deg
      else (
        select avg(s.mean_slope_deg)
        from public.official_precision_summaries as s
        join public.grid_sources as gs on gs.id = s.source_id
        where s.summary_class = 'terrain'
          and gs.slug = 'lantmateriet-dtm-1m'
          and s.geom operator(extensions.&&) c.geom
          and extensions.st_intersects(s.geom, c.geom)
          and s.mean_slope_deg is not null
      )
    end,
    median_slope_deg = case
      when not coalesce(v_dtm_evaluated, false) then c.median_slope_deg
      else (
        select percentile_cont(0.5) within group (order by s.median_slope_deg)
        from public.official_precision_summaries as s
        join public.grid_sources as gs on gs.id = s.source_id
        where s.summary_class = 'terrain'
          and gs.slug = 'lantmateriet-dtm-1m'
          and s.geom operator(extensions.&&) c.geom
          and extensions.st_intersects(s.geom, c.geom)
          and s.median_slope_deg is not null
      )
    end,
    p90_slope_deg = case
      when not coalesce(v_dtm_evaluated, false) then c.p90_slope_deg
      else (
        select percentile_cont(0.9) within group (order by s.p90_slope_deg)
        from public.official_precision_summaries as s
        join public.grid_sources as gs on gs.id = s.source_id
        where s.summary_class = 'terrain'
          and gs.slug = 'lantmateriet-dtm-1m'
          and s.geom operator(extensions.&&) c.geom
          and extensions.st_intersects(s.geom, c.geom)
          and s.p90_slope_deg is not null
      )
    end,
    pct_below_slope = case
      when not coalesce(v_dtm_evaluated, false) then c.pct_below_slope
      else (
        select
          case
            when v_threshold <= 5 then avg(s.pct_le_5)
            when v_threshold <= 8 then avg(s.pct_le_8)
            else avg(s.pct_le_12)
          end
        from public.official_precision_summaries as s
        join public.grid_sources as gs on gs.id = s.source_id
        where s.summary_class = 'terrain'
          and gs.slug = 'lantmateriet-dtm-1m'
          and s.geom operator(extensions.&&) c.geom
          and extensions.st_intersects(s.geom, c.geom)
      )
    end,
    pct_above_slope = case
      when not coalesce(v_dtm_evaluated, false) then null
      else (
        select greatest(
          0,
          100.0 - coalesce(
            case
              when v_threshold <= 5 then avg(s.pct_le_5)
              when v_threshold <= 8 then avg(s.pct_le_8)
              else avg(s.pct_le_12)
            end,
            0
          )
        )
        from public.official_precision_summaries as s
        join public.grid_sources as gs on gs.id = s.source_id
        where s.summary_class = 'terrain'
          and gs.slug = 'lantmateriet-dtm-1m'
          and s.geom operator(extensions.&&) c.geom
          and extensions.st_intersects(s.geom, c.geom)
      )
    end,
    elev_min_m = case
      when not coalesce(v_dtm_evaluated, false) then null
      else (
        select min(s.elev_min_m)
        from public.official_precision_summaries as s
        join public.grid_sources as gs on gs.id = s.source_id
        where s.summary_class = 'terrain'
          and gs.slug = 'lantmateriet-dtm-1m'
          and s.geom operator(extensions.&&) c.geom
          and extensions.st_intersects(s.geom, c.geom)
          and s.elev_min_m is not null
      )
    end,
    elev_max_m = case
      when not coalesce(v_dtm_evaluated, false) then null
      else (
        select max(s.elev_max_m)
        from public.official_precision_summaries as s
        join public.grid_sources as gs on gs.id = s.source_id
        where s.summary_class = 'terrain'
          and gs.slug = 'lantmateriet-dtm-1m'
          and s.geom operator(extensions.&&) c.geom
          and extensions.st_intersects(s.geom, c.geom)
          and s.elev_max_m is not null
      )
    end,
    elev_range_m = case
      when not coalesce(v_dtm_evaluated, false) then null
      else (
        select max(s.elev_max_m) - min(s.elev_min_m)
        from public.official_precision_summaries as s
        join public.grid_sources as gs on gs.id = s.source_id
        where s.summary_class = 'terrain'
          and gs.slug = 'lantmateriet-dtm-1m'
          and s.geom operator(extensions.&&) c.geom
          and extensions.st_intersects(s.geom, c.geom)
          and s.elev_min_m is not null
          and s.elev_max_m is not null
      )
    end,
    terrain_queried = case
      when coalesce(v_dtm_evaluated, false) then true
      else c.terrain_queried
    end
  where c.run_id = p_run_id
    and c.candidate_kind = 'site';
end;
$$;

revoke all on function public.apply_detailed_terrain_to_run(uuid) from public, anon;
grant execute on function public.apply_detailed_terrain_to_run(uuid) to authenticated, service_role;

-- Ensure grid source exists
insert into public.grid_sources (
  name, slug, source_type, publisher, base_url, country_code, active, authority_level, update_frequency, refresh_interval_hours
) values (
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
)
on conflict (slug) do update
set
  name = excluded.name,
  publisher = excluded.publisher,
  base_url = excluded.base_url,
  active = true,
  authority_level = 'official',
  refresh_interval_hours = excluded.refresh_interval_hours;
