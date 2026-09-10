-- Site-generation v2: Opportunity Zones (regional dissolve) + Candidate Sites (target-fit).
-- Ranking methodology suitability-v4. Does not treat a surviving county-scale region as a site.

alter table public.opportunity_searches
  add column if not exists target_site_area_ha numeric,
  add column if not exists max_candidate_area_ha numeric,
  add column if not exists max_returned_candidates integer;

alter table public.opportunity_run_candidates
  drop constraint if exists opportunity_run_candidates_kind_check;
alter table public.opportunity_run_candidates
  add constraint opportunity_run_candidates_kind_check
  check (candidate_kind in ('area', 'cell', 'zone', 'site'));

alter table public.opportunity_run_candidates
  add column if not exists parent_zone_id uuid,
  add column if not exists site_index integer,
  add column if not exists geometry_quality text,
  add column if not exists geometry_quality_reason text,
  add column if not exists target_fit_score numeric,
  add column if not exists target_fit_label text,
  add column if not exists compactness numeric,
  add column if not exists seed_score numeric;

create table if not exists public.opportunity_run_zones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  run_id uuid not null references public.opportunity_search_runs (id) on delete cascade,
  search_id uuid not null references public.opportunity_searches (id) on delete cascade,
  zone_index integer not null,
  name text not null,
  geom extensions.geometry(multipolygon, 4326) not null,
  centroid extensions.geometry(point, 4326),
  usable_area_ha numeric,
  created_at timestamptz not null default now(),
  unique (run_id, zone_index)
);

create index if not exists opportunity_run_zones_run_idx
  on public.opportunity_run_zones using gist (geom);
create index if not exists opportunity_run_zones_org_run_idx
  on public.opportunity_run_zones (organization_id, run_id);

alter table public.opportunity_run_zones enable row level security;

drop policy if exists opportunity_run_zones_select_authenticated on public.opportunity_run_zones;
create policy opportunity_run_zones_select_authenticated
  on public.opportunity_run_zones for select to authenticated
  using (private.belongs_to_organization(organization_id));

drop policy if exists opportunity_run_zones_insert_authenticated on public.opportunity_run_zones;
create policy opportunity_run_zones_insert_authenticated
  on public.opportunity_run_zones for insert to authenticated
  with check (private.can_write_organization(organization_id));

drop policy if exists opportunity_run_zones_delete_authenticated on public.opportunity_run_zones;
create policy opportunity_run_zones_delete_authenticated
  on public.opportunity_run_zones for delete to authenticated
  using (private.can_write_organization(organization_id));

grant select, insert, delete on public.opportunity_run_zones to authenticated, service_role;

create or replace function private.site_area_profile(
  p_min numeric,
  p_target numeric,
  p_max numeric,
  p_returned integer
)
returns table (min_ha numeric, target_ha numeric, max_ha numeric, max_returned integer)
language sql
immutable
as $$
  select
    greatest(0.5, coalesce(p_min, 8)),
    greatest(greatest(0.5, coalesce(p_min, 8)), coalesce(p_target, 15)),
    greatest(
      greatest(greatest(0.5, coalesce(p_min, 8)), coalesce(p_target, 15)),
      coalesce(p_max, 30)
    ),
    least(100, greatest(1, coalesce(p_returned, 25)));
$$;

create or replace function public.segment_opportunity_run_into_sites(p_run_id uuid)
returns table (
  zone_count integer,
  site_count integer,
  seed_count integer,
  before_dedupe integer,
  after_dedupe integer,
  duration_ms integer
)
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_started timestamptz := clock_timestamp();
  v_user uuid;
  v_role text;
  v_run public.opportunity_search_runs%rowtype;
  v_search public.opportunity_searches%rowtype;
  v_min numeric;
  v_target numeric;
  v_max numeric;
  v_returned integer;
  v_spacing numeric;
  v_r_target numeric;
  v_r_max numeric;
  v_usable extensions.geometry;
  v_usable_3006 extensions.geometry;
  v_lc jsonb;
  v_seed record;
  v_geom extensions.geometry;
  v_ha numeric;
  v_score numeric;
  v_keep boolean;
  v_iou numeric;
  v_perim numeric;
  v_compact numeric;
  v_core numeric;
  v_quality text;
  v_quality_reason text;
  v_fit_score numeric;
  v_fit_label text;
  v_place text;
  v_dir text;
  v_cx double precision;
  v_cy double precision;
  v_dx double precision;
  v_dy double precision;
  v_zone uuid;
  v_index integer := 0;
  v_before integer := 0;
  v_seeds integer := 0;
  v_zones integer := 0;
  v_after integer := 0;
  v_cell_index integer := 0;
begin
  perform set_config('statement_timeout', '180000', true);
  v_user := auth.uid();
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_run from public.opportunity_search_runs where id = p_run_id;
  if v_run.id is null then
    raise exception 'Run not found' using errcode = '22023';
  end if;

  select m.role into v_role
  from public.organization_members as m
  where m.profile_id = v_user
    and m.organization_id = v_run.organization_id;
  if v_role is null or v_role not in ('owner', 'admin', 'member') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into v_search from public.opportunity_searches where id = v_run.search_id;
  select min_ha, target_ha, max_ha, max_returned
    into v_min, v_target, v_max, v_returned
  from private.site_area_profile(
    v_search.min_site_area_ha,
    v_search.target_site_area_ha,
    v_search.max_candidate_area_ha,
    v_search.max_returned_candidates
  );

  v_lc := coalesce(v_search.land_cover_rules, '{}'::jsonb);
  v_r_target := sqrt(v_target * 10000.0 / pg_catalog.pi());
  v_r_max := sqrt(v_max * 10000.0 / pg_catalog.pi());
  v_spacing := 0.75 * 2.0 * v_r_target;

  delete from public.opportunity_run_zones where run_id = p_run_id;
  delete from public.opportunity_run_candidates
  where run_id = p_run_id
    and candidate_kind = 'site';

  insert into public.opportunity_run_zones (
    organization_id, run_id, search_id, zone_index, name, geom, centroid, usable_area_ha
  )
  select
    c.organization_id,
    c.run_id,
    c.search_id,
    row_number() over (order by c.contiguous_area_ha desc nulls last, c.cell_index),
    format(
      '%s opportunity zone %s',
      coalesce(nullif(v_search.municipality, ''), nullif(v_search.region, ''), 'Search'),
      row_number() over (order by c.contiguous_area_ha desc nulls last, c.cell_index)
    ),
    c.geom,
    c.centroid,
    coalesce(c.contiguous_area_ha, c.usable_area_ha)
  from public.opportunity_run_candidates as c
  where c.run_id = p_run_id
    and c.geom is not null
    and (
      (c.candidate_kind = 'area' and c.excluded = false)
      or c.candidate_kind = 'zone'
    );

  get diagnostics v_zones = row_count;

  update public.opportunity_run_candidates
  set candidate_kind = 'zone',
      excluded = true,
      exclusion_reason = 'Regional opportunity zone — not a candidate site. Investigate sites generated inside this zone.'
  where run_id = p_run_id
    and candidate_kind in ('area', 'zone');

  select extensions.st_unaryunion(extensions.st_collect(geom))
    into v_usable
  from public.opportunity_run_zones
  where run_id = p_run_id;
  if v_usable is null or extensions.st_isempty(v_usable) then
    zone_count := v_zones;
    site_count := 0;
    seed_count := 0;
    before_dedupe := 0;
    after_dedupe := 0;
    duration_ms := greatest(1, floor(extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer);
    return next;
    return;
  end if;

  v_usable := extensions.st_multi(
    extensions.st_collectionextract(extensions.st_makevalid(v_usable), 3)
  );
  v_usable_3006 := extensions.st_transform(v_usable, 3006);
  v_spacing := greatest(
    0.75 * 2.0 * v_r_target,
    sqrt(greatest(extensions.st_area(v_usable_3006), 1) / 900.0)
  );

  create temporary table if not exists tmp_site_seeds (
    id integer generated always as identity primary key,
    zone_id uuid,
    geom_3006 extensions.geometry,
    geom_4326 extensions.geometry,
    score numeric,
    used boolean not null default false
  ) on commit drop;
  truncate tmp_site_seeds;

  create temporary table if not exists tmp_grown_sites (
    id integer generated always as identity primary key,
    zone_id uuid,
    seed_score numeric,
    geom extensions.geometry,
    usable_ha numeric,
    keep boolean not null default true
  ) on commit drop;
  truncate tmp_grown_sites;

  insert into tmp_site_seeds (zone_id, geom_3006, geom_4326, score)
  select
    z.id,
    pt.geom_3006,
    extensions.st_transform(pt.geom_3006, 4326),
    0.5
  from public.opportunity_run_zones as z
  cross join lateral (
    select extensions.st_centroid(grid.geom) as geom_3006
    from extensions.st_squaregrid(v_spacing, extensions.st_transform(z.geom, 3006)) as grid
    where extensions.st_contains(extensions.st_transform(z.geom, 3006), extensions.st_centroid(grid.geom))
  ) as pt
  where z.run_id = p_run_id;

  get diagnostics v_seeds = row_count;

  update tmp_site_seeds as s
  set score = least(1, greatest(0,
    0.45 * case coalesce(lc.land_cover_group, 'unclassified')
      when 'water' then case when coalesce(v_lc->>'water', 'excluded') = 'excluded' then 0
        when v_lc->>'water' = 'preferred' then 1 when v_lc->>'water' = 'deprioritised' then 0.25 else 0.55 end
      when 'wetland' then case when coalesce(v_lc->>'wetland', 'excluded') = 'excluded' then 0
        when v_lc->>'wetland' = 'preferred' then 1 when v_lc->>'wetland' = 'deprioritised' then 0.25 else 0.55 end
      when 'forest' then case when coalesce(v_lc->>'forest', 'neutral') = 'preferred' then 1
        when v_lc->>'forest' = 'deprioritised' then 0.25 when v_lc->>'forest' = 'excluded' then 0 else 0.55 end
      when 'agriculture' then case when coalesce(v_lc->>'agriculture', 'deprioritised') = 'preferred' then 1
        when v_lc->>'agriculture' = 'deprioritised' then 0.25 when v_lc->>'agriculture' = 'excluded' then 0 else 0.55 end
      when 'open' then case when coalesce(v_lc->>'open', 'preferred') = 'preferred' then 1
        when v_lc->>'open' = 'deprioritised' then 0.25 when v_lc->>'open' = 'excluded' then 0 else 0.55 end
      when 'developed' then case when coalesce(v_lc->>'developed', 'deprioritised') = 'preferred' then 1
        when v_lc->>'developed' = 'deprioritised' then 0.25 when v_lc->>'developed' = 'excluded' then 0 else 0.55 end
      else 0.45
    end
    + 0.35 * coalesce(
      case
        when terr.mean_slope_deg is null then 0.5
        else greatest(0, 1 - terr.mean_slope_deg / 12.0)
      end,
      0.5
    )
    + 0.20 * least(1, coalesce(prot.dist_m, 800) / 500.0)
  ))
  from tmp_site_seeds as seed
  left join lateral (
    select p.land_cover_group
    from public.official_physical_summaries as p
    where p.summary_class = 'land_cover'
      and p.geom operator(extensions.&&) seed.geom_4326
      and extensions.st_intersects(p.geom, seed.geom_4326)
    order by p.geom operator(extensions.<->) seed.geom_4326
    limit 1
  ) as lc on true
  left join lateral (
    select p.mean_slope_deg
    from public.official_physical_summaries as p
    where p.summary_class = 'terrain'
      and p.geom operator(extensions.&&) seed.geom_4326
      and extensions.st_intersects(p.geom, seed.geom_4326)
    order by p.geom operator(extensions.<->) seed.geom_4326
    limit 1
  ) as terr on true
  left join lateral (
    select extensions.st_distance(seed.geom_4326::extensions.geography, f.geom::extensions.geography) as dist_m
    from public.official_geographic_features as f
    where f.feature_class = 'protected_area'
      and f.geom operator(extensions.&&) extensions.st_expand(seed.geom_4326, 0.08)
    order by seed.geom_4326 operator(extensions.<->) f.geom
    limit 1
  ) as prot on true
  where s.id = seed.id;

  delete from tmp_site_seeds where score < 0.2;
  delete from tmp_site_seeds
  where id not in (
    select id from tmp_site_seeds order by score desc, id limit 400
  );

  for v_seed in
    select *
    from tmp_site_seeds
    order by score desc, id
  loop
    if exists (
      select 1 from tmp_grown_sites as g
      where g.keep
        and extensions.st_distance(g.geom::extensions.geography, v_seed.geom_4326::extensions.geography) < v_spacing
    ) then
      continue;
    end if;

    v_geom := extensions.st_multi(
      extensions.st_collectionextract(
        extensions.st_makevalid(
          extensions.st_intersection(
            extensions.st_transform(extensions.st_buffer(v_seed.geom_3006, v_r_target), 4326),
            v_usable
          )
        ),
        3
      )
    );
    if v_geom is null or extensions.st_isempty(v_geom) then
      continue;
    end if;
    v_ha := extensions.st_area(v_geom::extensions.geography) / 10000.0;
    if v_ha < v_min then
      v_geom := extensions.st_multi(
        extensions.st_collectionextract(
          extensions.st_makevalid(
            extensions.st_intersection(
              extensions.st_transform(extensions.st_buffer(v_seed.geom_3006, v_r_max), 4326),
              v_usable
            )
          ),
          3
        )
      );
      v_ha := extensions.st_area(v_geom::extensions.geography) / 10000.0;
    end if;
    if v_ha > v_max then
      v_geom := extensions.st_multi(
        extensions.st_collectionextract(
          extensions.st_makevalid(
            extensions.st_intersection(
              extensions.st_transform(
                extensions.st_buffer(v_seed.geom_3006, v_r_target * sqrt(v_max / greatest(v_ha, v_target))),
                4326
              ),
              v_usable
            )
          ),
          3
        )
      );
      v_ha := extensions.st_area(v_geom::extensions.geography) / 10000.0;
    end if;
    if v_ha < v_min or v_geom is null or extensions.st_isempty(v_geom) then
      continue;
    end if;

    v_keep := true;
    for v_iou in
      select
        extensions.st_area(extensions.st_intersection(g.geom, v_geom)::extensions.geography)
        / nullif(extensions.st_area(extensions.st_union(g.geom, v_geom)::extensions.geography), 0)
      from tmp_grown_sites as g
      where g.keep
        and g.geom && v_geom
        and extensions.st_intersects(g.geom, v_geom)
    loop
      if coalesce(v_iou, 0) >= 0.5 then
        v_keep := false;
        exit;
      end if;
    end loop;
    if not v_keep then
      continue;
    end if;

    insert into tmp_grown_sites (zone_id, seed_score, geom, usable_ha, keep)
    values (v_seed.zone_id, v_seed.score, v_geom, v_ha, true);
    v_before := v_before + 1;
    if v_before >= v_returned * 3 then
      exit;
    end if;
  end loop;

  v_cx := (coalesce(v_search.west, v_run.west) + coalesce(v_search.east, v_run.east)) / 2.0;
  v_cy := (coalesce(v_search.south, v_run.south) + coalesce(v_search.north, v_run.north)) / 2.0;

  for v_seed in
    select *
    from tmp_grown_sites
    where keep
    order by seed_score desc, usable_ha desc, id
    limit v_returned
  loop
    v_index := v_index + 1;
    v_cell_index := 1000 + v_index;
    v_perim := extensions.st_perimeter(v_seed.geom::extensions.geography);
    v_compact := case
      when v_perim > 0 then (4 * pg_catalog.pi() * (v_seed.usable_ha * 10000.0)) / (v_perim * v_perim)
      else 0
    end;
    v_core := extensions.st_area(
      extensions.st_transform(
        extensions.st_buffer(extensions.st_transform(v_seed.geom, 3006), -40),
        4326
      )::extensions.geography
    ) / 10000.0;
    if v_compact < 0.22 then
      v_quality := 'review';
      v_quality_reason := 'Candidate is elongated relative to its area (low compactness). Screening geometry quality only — not constructability.';
    elsif v_seed.usable_ha > 0 and coalesce(v_core, 0) / v_seed.usable_ha < 0.6 then
      v_quality := 'review';
      v_quality_reason := 'Candidate contains a narrow connection between larger usable sections. Screening geometry quality only — not constructability.';
    else
      v_quality := 'pass';
      v_quality_reason := 'Shape is compact enough for screening comparison.';
    end if;

    if v_seed.usable_ha < v_min then
      v_fit_score := 0;
      v_fit_label := format('Below the configured minimum %s ha contiguous usable area.', v_min);
    elsif v_seed.usable_ha <= v_target then
      v_fit_score := 0.55 + 0.45 * (v_seed.usable_ha - v_min) / greatest(v_target - v_min, 0.01);
      v_fit_label := format('Approaching configured target %s ha (%s ha usable).', v_target, round(v_seed.usable_ha, 1));
    elsif v_seed.usable_ha <= v_max then
      v_fit_score := 1;
      v_fit_label := format(
        'Strong target-area fit. Configured target %s ha; candidate %s ha stays within the %s ha maximum. Extra hectares do not add ranking benefit.',
        v_target, round(v_seed.usable_ha, 1), v_max
      );
    else
      v_fit_score := greatest(0.15, v_target / v_seed.usable_ha);
      v_fit_label := format(
        'Area exceeds the configured %s ha maximum candidate size. Size itself provides no additional ranking benefit beyond the %s ha target.',
        v_max, v_target
      );
    end if;

    v_dx := extensions.st_x(extensions.st_centroid(v_seed.geom)) - v_cx;
    v_dy := extensions.st_y(extensions.st_centroid(v_seed.geom)) - v_cy;
    select a.name into v_place
    from public.official_administrative_areas as a
    where a.area_class = 'municipality'
      and a.geom operator(extensions.&&) extensions.st_centroid(v_seed.geom)
      and extensions.st_intersects(a.geom, extensions.st_centroid(v_seed.geom))
    order by a.name
    limit 1;
    v_place := coalesce(v_place, nullif(v_search.municipality, ''), nullif(v_search.region, ''), 'Search');
    if abs(v_dx) < abs(v_dy) * 0.4 then
      v_dir := case when v_dy >= 0 then 'North' else 'South' end;
    elsif abs(v_dy) < abs(v_dx) * 0.4 then
      v_dir := case when v_dx >= 0 then 'East' else 'West' end;
    else
      v_dir := format(
        '%s-%s',
        case when v_dy >= 0 then 'North' else 'South' end,
        case when v_dx >= 0 then 'East' else 'West' end
      );
    end if;

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
      usable_area_ha,
      contiguous_area_ha,
      parent_zone_id,
      site_index,
      geometry_quality,
      geometry_quality_reason,
      target_fit_score,
      target_fit_label,
      compactness,
      seed_score,
      screening_stage,
      ranking_version
    )
    values (
      v_run.organization_id,
      p_run_id,
      v_run.search_id,
      v_cell_index,
      'site',
      format('%s %s - Site %s', v_place, v_dir, lpad(v_index::text, 2, '0')),
      extensions.st_y(extensions.st_centroid(v_seed.geom)),
      extensions.st_x(extensions.st_centroid(v_seed.geom)),
      v_seed.geom,
      extensions.st_centroid(v_seed.geom),
      v_seed.usable_ha,
      v_seed.usable_ha,
      v_seed.usable_ha,
      v_seed.zone_id,
      v_index,
      v_quality,
      v_quality_reason,
      v_fit_score,
      v_fit_label,
      v_compact,
      v_seed.seed_score,
      'discovery',
      'suitability-v4'
    );
  end loop;

  update public.opportunity_run_candidates as c
  set
    protected_overlap_pct = coalesce((
      select case when count(*) = 0 then 0
      else 100.0 * extensions.st_area(
        extensions.st_intersection(c.geom, extensions.st_unaryunion(extensions.st_collect(f.geom)))::extensions.geography
      ) / nullif(extensions.st_area(c.geom::extensions.geography), 0)
      end
      from public.official_geographic_features as f
      where f.feature_class = 'protected_area'
        and f.geom operator(extensions.&&) c.geom
        and extensions.st_intersects(f.geom, c.geom)
    ), 0),
    natura_overlap_pct = case
      when exists (select 1 from public.official_geographic_features where feature_class = 'natura_2000') then coalesce((
      select case when count(*) = 0 then 0
      else 100.0 * extensions.st_area(
        extensions.st_intersection(c.geom, extensions.st_unaryunion(extensions.st_collect(f.geom)))::extensions.geography
      ) / nullif(extensions.st_area(c.geom::extensions.geography), 0)
      end
      from public.official_geographic_features as f
      where f.feature_class = 'natura_2000'
        and f.geom operator(extensions.&&) c.geom
        and extensions.st_intersects(f.geom, c.geom)
    ), 0)
      else null
    end,
    protected_queried = exists (select 1 from public.official_geographic_features where feature_class = 'protected_area'),
    natura_queried = exists (select 1 from public.official_geographic_features where feature_class = 'natura_2000'),
    mean_slope_deg = (
      select sum(s.mean_slope_deg * extensions.st_area(extensions.st_intersection(s.geom, c.geom)::extensions.geography))
        / nullif(sum(extensions.st_area(extensions.st_intersection(s.geom, c.geom)::extensions.geography)), 0)
      from public.official_physical_summaries as s
      where s.summary_class = 'terrain'
        and s.geom operator(extensions.&&) c.geom
        and extensions.st_intersects(s.geom, c.geom)
    ),
    terrain_queried = exists (select 1 from public.official_physical_summaries where summary_class = 'terrain'),
    land_cover = coalesce((
      select jsonb_object_agg(land_cover_group, pct)
      from (
        select
          s.land_cover_group,
          100.0 * sum(extensions.st_area(extensions.st_intersection(s.geom, c.geom)::extensions.geography))
            / nullif(extensions.st_area(c.geom::extensions.geography), 0) as pct
        from public.official_physical_summaries as s
        where s.summary_class = 'land_cover'
          and s.land_cover_group is not null
          and s.geom operator(extensions.&&) c.geom
          and extensions.st_intersects(s.geom, c.geom)
        group by s.land_cover_group
      ) as grouped
    ), '{}'::jsonb),
    land_cover_queried = exists (select 1 from public.official_physical_summaries where summary_class = 'land_cover'),
    land_cover_provider_key = case
      when exists (select 1 from public.official_precision_summaries where summary_class = 'land_cover') then 'nv-nmd-2023'
      when exists (select 1 from public.official_physical_summaries where summary_class = 'land_cover') then 'nv-nmd-2018'
      else null
    end,
    land_cover_resolution = 'coarse',
    terrain_provider_key = 'copernicus-dem-glo90',
    terrain_resolution = 'coarse',
    exclusion_breakdown = jsonb_build_object(
      'grossHa', c.gross_area_ha,
      'protectedHa', 0,
      'naturaHa', 0,
      'terrainHa', 0,
      'landCoverHa', 0,
      'remainingHa', c.usable_area_ha,
      'largestContiguousHa', c.contiguous_area_ha,
      'targetFit', c.target_fit_label
    )
  where c.run_id = p_run_id
    and c.candidate_kind = 'site';

  select count(*)::int into v_after
  from public.opportunity_run_candidates
  where run_id = p_run_id and candidate_kind = 'site';

  update public.opportunity_search_runs
  set
    ranking_version = 'suitability-v4',
    methodology_version = 'site-generation-v2',
    methodology = 'site-generation-v2: opportunity zones from dissolved remaining geography; candidate sites grown to configured target/max area from deterministic evidence seeds. Extra hectares above target do not dominate ranking.',
    returned_count = v_after,
    operational_metrics = coalesce(operational_metrics, '{}'::jsonb) || jsonb_build_object(
      'siteGeneration', jsonb_build_object(
        'version', 'site-generation-v2',
        'zoneCount', v_zones,
        'seedCount', v_seeds,
        'beforeDedupe', v_before,
        'afterDedupe', v_after,
        'minHa', v_min,
        'targetHa', v_target,
        'maxHa', v_max,
        'dedupeIou', 0.5,
        'cellM', v_spacing
      )
    )
  where id = p_run_id;

  zone_count := v_zones;
  site_count := v_after;
  seed_count := v_seeds;
  before_dedupe := v_before;
  after_dedupe := v_after;
  duration_ms := greatest(1, floor(extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer);
  return next;
end;
$$;

revoke all on function public.segment_opportunity_run_into_sites(uuid) from public, anon;
grant execute on function public.segment_opportunity_run_into_sites(uuid) to authenticated, service_role;

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
        'geometryQuality', c.geometry_quality,
        'targetFit', c.target_fit_label,
        'screeningStage', c.screening_stage,
        'refinementStatus', c.refinement_status,
        'terrainResolution', c.terrain_resolution,
        'landCoverResolution', c.land_cover_resolution
      )
    ) as feature
    from public.opportunity_run_candidates as c
    where c.run_id = p_run_id
      and c.organization_id = v_org
      and c.candidate_kind = 'site'
    union all
    select jsonb_build_object(
      'type', 'Feature',
      'id', z.id,
      'geometry', extensions.st_asgeojson(
        coalesce(extensions.st_simplifypreservetopology(z.geom, 0.0004), z.geom)
      )::jsonb,
      'properties', jsonb_build_object(
        'id', z.id,
        'name', z.name,
        'rank', z.zone_index,
        'recommendation', 'secondary',
        'excluded', false,
        'usableAreaHa', z.usable_area_ha,
        'candidateKind', 'zone'
      )
    ) as feature
    from public.opportunity_run_zones as z
    where z.run_id = p_run_id
      and z.organization_id = v_org
  ) as features;

  return v_result;
end;
$$;

revoke all on function public.get_opportunity_run_geojson(uuid) from public, anon;
grant execute on function public.get_opportunity_run_geojson(uuid) to authenticated, service_role;
