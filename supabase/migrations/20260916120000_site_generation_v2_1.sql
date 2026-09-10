-- Site-generation v2.1: grow Candidate Sites from usable land units, not seed buffers.
-- Target area is a preference. Geometry quality must not prefer circles.

create or replace function private.land_cover_pref_score(p_group text, p_rules jsonb)
returns numeric
language sql
immutable
as $$
  select case coalesce(p_group, 'unclassified')
    when 'water' then case when coalesce(p_rules->>'water', 'excluded') = 'excluded' then 0
      when p_rules->>'water' = 'preferred' then 1 when p_rules->>'water' = 'deprioritised' then 0.25 else 0.55 end
    when 'wetland' then case when coalesce(p_rules->>'wetland', 'excluded') = 'excluded' then 0
      when p_rules->>'wetland' = 'preferred' then 1 when p_rules->>'wetland' = 'deprioritised' then 0.25 else 0.55 end
    when 'forest' then case when coalesce(p_rules->>'forest', 'neutral') = 'preferred' then 1
      when p_rules->>'forest' = 'deprioritised' then 0.25 when p_rules->>'forest' = 'excluded' then 0 else 0.55 end
    when 'agriculture' then case when coalesce(p_rules->>'agriculture', 'deprioritised') = 'preferred' then 1
      when p_rules->>'agriculture' = 'deprioritised' then 0.25 when p_rules->>'agriculture' = 'excluded' then 0 else 0.55 end
    when 'open' then case when coalesce(p_rules->>'open', 'preferred') = 'preferred' then 1
      when p_rules->>'open' = 'deprioritised' then 0.25 when p_rules->>'open' = 'excluded' then 0 else 0.55 end
    when 'developed' then case when coalesce(p_rules->>'developed', 'deprioritised') = 'preferred' then 1
      when p_rules->>'developed' = 'deprioritised' then 0.25 when p_rules->>'developed' = 'excluded' then 0 else 0.55 end
    else 0.45
  end;
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
set search_path = public, extensions, private, pg_catalog
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
  v_cell_m numeric := 150;
  v_usable extensions.geometry;
  v_usable_3006 extensions.geometry;
  v_lc jsonb;
  v_unit record;
  v_ids integer[];
  v_nid integer;
  v_narea numeric;
  v_geom extensions.geometry;
  v_ha numeric;
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
  v_index integer := 0;
  v_before integer := 0;
  v_seeds integer := 0;
  v_zones integer := 0;
  v_after integer := 0;
  v_cell_index integer := 0;
  v_attempts integer := 0;
  v_parts integer;
  v_aspect numeric;
  v_env_area numeric;
  v_usable_ratio numeric;
  v_env extensions.geometry;
begin
  perform set_config('statement_timeout', '600000', false);
  perform set_config('statement_timeout', '600000', true);
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

  create temporary table if not exists tmp_land_units (
    id integer generated always as identity primary key,
    zone_id uuid,
    i integer,
    j integer,
    geom extensions.geometry,
    area_ha numeric,
    score numeric not null default 0,
    eligible boolean not null default false,
    used boolean not null default false
  ) on commit drop;
  truncate tmp_land_units;

  create temporary table if not exists tmp_grown_sites (
    id integer generated always as identity primary key,
    zone_id uuid,
    seed_score numeric,
    geom extensions.geometry,
    usable_ha numeric,
    keep boolean not null default true
  ) on commit drop;
  truncate tmp_grown_sites;

  insert into tmp_land_units (zone_id, i, j, geom, area_ha, score, eligible)
  select distinct on (ranked.zone_id, ranked.i, ranked.j)
    ranked.zone_id,
    ranked.i,
    ranked.j,
    ranked.geom,
    ranked.area_ha,
    ranked.score,
    true
  from (
    select
      z.id as zone_id,
      grid.i,
      grid.j,
      extensions.st_multi(extensions.st_transform(clipped.geom, 4326)) as geom,
      extensions.st_area(clipped.geom) / 10000.0 as area_ha,
      least(1, greatest(0,
        0.6 * private.land_cover_pref_score(lc.land_cover_group, v_lc)
        + 0.4 * coalesce(
          case when terr.mean_slope_deg is null then 0.5 else greatest(0, 1 - terr.mean_slope_deg / 12.0) end,
          0.5
        )
      )) as score
    from public.opportunity_run_zones as z
    join public.official_physical_summaries as lc
      on lc.summary_class = 'land_cover'
      and lc.geom && z.geom
      and extensions.st_intersects(lc.geom, z.geom)
      and private.land_cover_pref_score(lc.land_cover_group, v_lc) > 0
    left join lateral (
      select p.mean_slope_deg
      from public.official_physical_summaries as p
      where p.summary_class = 'terrain'
        and p.geom && lc.geom
        and extensions.st_intersects(p.geom, extensions.st_centroid(lc.geom))
      limit 1
    ) as terr on true
    cross join lateral (
      select extensions.st_transform(extensions.st_intersection(z.geom, lc.geom), 3006) as geom_3006
    ) as piece
    cross join lateral (
      select g.i, g.j, g.geom
      from extensions.st_squaregrid(v_cell_m, piece.geom_3006) as g
    ) as grid
    cross join lateral (
      select extensions.st_collectionextract(
        extensions.st_intersection(grid.geom, piece.geom_3006),
        3
      ) as geom
    ) as clipped
    where z.run_id = p_run_id
      and piece.geom_3006 is not null
      and not extensions.st_isempty(piece.geom_3006)
      and clipped.geom is not null
      and not extensions.st_isempty(clipped.geom)
      and extensions.st_area(clipped.geom) > 2000
  ) as ranked
  where ranked.score >= 0.28
  order by ranked.zone_id, ranked.i, ranked.j, ranked.score desc;

  get diagnostics v_seeds = row_count;
  delete from tmp_land_units where not eligible;
  create index if not exists tmp_land_units_zone_ij on tmp_land_units (zone_id, i, j);
  create index if not exists tmp_land_units_score on tmp_land_units (score desc, id);

  for v_unit in
    select *
    from tmp_land_units
    where eligible and not used
    order by score desc, id
  loop
    v_attempts := v_attempts + 1;
    if v_attempts > 400 or v_before >= v_returned * 3 then
      exit;
    end if;
    if exists (select 1 from tmp_land_units as u where u.id = v_unit.id and u.used) then
      continue;
    end if;

    v_ids := array[v_unit.id];
    v_ha := v_unit.area_ha;

    loop
      exit when v_ha >= v_target;
      v_nid := null;
      select u.id, u.area_ha
        into v_nid, v_narea
      from unnest(v_ids) as grown(id)
      join tmp_land_units as s on s.id = grown.id
      join tmp_land_units as u
        on u.zone_id = s.zone_id
       and u.i between s.i - 1 and s.i + 1
       and u.j between s.j - 1 and s.j + 1
       and abs(u.i - s.i) + abs(u.j - s.j) = 1
       and not u.used
       and u.eligible
       and u.score >= greatest(0.4, v_unit.score * 0.55)
       and not (u.id = any (v_ids))
       and v_ha + u.area_ha <= v_max
      order by u.score desc, u.id
      limit 1;
      exit when v_nid is null;
      v_ids := v_ids || v_nid;
      v_ha := v_ha + v_narea;
    end loop;

    if v_ha < v_min then
      continue;
    end if;

    select extensions.st_multi(
      extensions.st_collectionextract(
        extensions.st_makevalid(extensions.st_unaryunion(extensions.st_collect(u.geom))),
        3
      )
    )
      into v_geom
    from tmp_land_units as u
    where u.id = any (v_ids);

    if v_geom is null or extensions.st_isempty(v_geom) then
      continue;
    end if;

    select extensions.st_multi(part.geom)
      into v_geom
    from extensions.st_dump(v_geom) as part
    order by extensions.st_area(part.geom) desc
    limit 1;

    v_ha := extensions.st_area(v_geom::extensions.geography) / 10000.0;
    if v_ha < v_min or v_ha > v_max then
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

    update tmp_land_units set used = true where id = any (v_ids);

    insert into tmp_grown_sites (zone_id, seed_score, geom, usable_ha, keep)
    values (v_unit.zone_id, v_unit.score, v_geom, v_ha, true);
    v_before := v_before + 1;
  end loop;

  v_cx := (coalesce(v_search.west, v_run.west) + coalesce(v_search.east, v_run.east)) / 2.0;
  v_cy := (coalesce(v_search.south, v_run.south) + coalesce(v_search.north, v_run.north)) / 2.0;

  for v_unit in
    select *
    from tmp_grown_sites
    where keep
    order by seed_score desc, usable_ha desc, id
    limit v_returned
  loop
    v_index := v_index + 1;
    v_cell_index := 1000 + v_index;
    v_perim := extensions.st_perimeter(v_unit.geom::extensions.geography);
    v_compact := case
      when v_perim > 0 then (4 * pg_catalog.pi() * (v_unit.usable_ha * 10000.0)) / (v_perim * v_perim)
      else 0
    end;
    v_core := extensions.st_area(
      extensions.st_transform(
        extensions.st_buffer(extensions.st_transform(v_unit.geom, 3006), -40),
        4326
      )::extensions.geography
    ) / 10000.0;
    v_parts := extensions.st_numgeometries(v_unit.geom);
    v_env := extensions.st_orientedenvelope(extensions.st_transform(v_unit.geom, 3006));
    v_aspect := case
      when extensions.st_xmin(v_env) is null then null
      when least(
        extensions.st_xmax(v_env) - extensions.st_xmin(v_env),
        extensions.st_ymax(v_env) - extensions.st_ymin(v_env)
      ) > 0
        then greatest(
          extensions.st_xmax(v_env) - extensions.st_xmin(v_env),
          extensions.st_ymax(v_env) - extensions.st_ymin(v_env)
        ) / least(
          extensions.st_xmax(v_env) - extensions.st_xmin(v_env),
          extensions.st_ymax(v_env) - extensions.st_ymin(v_env)
        )
      else null
    end;
    v_env_area := extensions.st_area(v_env);
    v_usable_ratio := case
      when v_env_area > 0 then (v_unit.usable_ha * 10000.0) / v_env_area
      else null
    end;

    if coalesce(v_parts, 1) > 1 then
      v_quality := 'review';
      v_quality_reason := 'Candidate is fragmented into multiple polygons. Screening geometry quality only — not constructability.';
    elsif v_compact < 0.12 then
      v_quality := 'review';
      v_quality_reason := 'Candidate is a narrow corridor or highly irregular relative to its area. Screening geometry quality only — not constructability.';
    elsif v_aspect is not null and v_aspect > 6 then
      v_quality := 'review';
      v_quality_reason := 'Candidate is elongated (high length-to-width). Screening geometry quality only — not constructability.';
    elsif v_unit.usable_ha > 0 and coalesce(v_core, 0) / v_unit.usable_ha < 0.55 then
      v_quality := 'review';
      v_quality_reason := 'Candidate contains a narrow connection between larger usable sections. Screening geometry quality only — not constructability.';
    elsif v_usable_ratio is not null and v_usable_ratio < 0.35 then
      v_quality := 'review';
      v_quality_reason := 'Usable geometry is a small fraction of the envelope. Screening geometry quality only — not constructability.';
    else
      v_quality := 'pass';
      v_quality_reason := 'Shape is practical enough for screening comparison. Compactness is not a preference for circular sites.';
    end if;

    if v_unit.usable_ha < v_min then
      v_fit_score := 0;
      v_fit_label := format('Below the configured minimum %s ha contiguous usable area.', v_min);
    elsif v_unit.usable_ha <= v_target then
      v_fit_score := 0.55 + 0.45 * (v_unit.usable_ha - v_min) / greatest(v_target - v_min, 0.01);
      v_fit_label := format(
        'Approaching configured target %s ha (%s ha usable). Target is a preference, not a required footprint.',
        v_target, round(v_unit.usable_ha, 1)
      );
    elsif v_unit.usable_ha <= v_max then
      v_fit_score := 1;
      v_fit_label := format(
        'Strong target-area fit. Configured target %s ha; candidate %s ha stays within the %s ha maximum. Extra hectares do not add ranking benefit.',
        v_target, round(v_unit.usable_ha, 1), v_max
      );
    else
      v_fit_score := greatest(0.15, v_target / v_unit.usable_ha);
      v_fit_label := format(
        'Area exceeds the configured %s ha maximum candidate size. Size itself provides no additional ranking benefit beyond the %s ha target.',
        v_max, v_target
      );
    end if;

    v_dx := extensions.st_x(extensions.st_centroid(v_unit.geom)) - v_cx;
    v_dy := extensions.st_y(extensions.st_centroid(v_unit.geom)) - v_cy;
    select a.name into v_place
    from public.official_administrative_areas as a
    where a.area_class = 'municipality'
      and a.geom && extensions.st_centroid(v_unit.geom)
      and extensions.st_intersects(a.geom, extensions.st_centroid(v_unit.geom))
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
      ranking_version,
      covering_queried
    )
    values (
      v_run.organization_id,
      p_run_id,
      v_run.search_id,
      v_cell_index,
      'site',
      format('%s %s - Site %s', v_place, v_dir, lpad(v_index::text, 2, '0')),
      extensions.st_y(extensions.st_centroid(v_unit.geom)),
      extensions.st_x(extensions.st_centroid(v_unit.geom)),
      v_unit.geom,
      extensions.st_centroid(v_unit.geom),
      v_unit.usable_ha,
      v_unit.usable_ha,
      v_unit.usable_ha,
      v_unit.zone_id,
      v_index,
      v_quality,
      v_quality_reason,
      v_fit_score,
      v_fit_label,
      v_compact,
      v_unit.seed_score,
      'discovery',
      'suitability-v4',
      true
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
        and f.geom && c.geom
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
        and f.geom && c.geom
        and extensions.st_intersects(f.geom, c.geom)
    ), 0)
      else null
    end,
    protected_queried = exists (select 1 from public.official_geographic_features where feature_class = 'protected_area'),
    natura_queried = exists (select 1 from public.official_geographic_features where feature_class = 'natura_2000'),
    local_covering_name = (
      select area.name
      from private.ei_local_network_areas_covering_geom(c.centroid) as area
      order by extensions.st_area(area.geometry::extensions.geography) asc
      limit 1
    ),
    nup_covering_name = (
      select area.name
      from private.ei_nup_planning_areas_covering_geom(c.centroid) as area
      order by extensions.st_area(area.geometry::extensions.geography) asc
      limit 1
    ),
    covering_queried = true,
    mean_slope_deg = (
      select sum(s.mean_slope_deg * extensions.st_area(extensions.st_intersection(s.geom, c.geom)::extensions.geography))
        / nullif(sum(extensions.st_area(extensions.st_intersection(s.geom, c.geom)::extensions.geography)), 0)
      from public.official_physical_summaries as s
      where s.summary_class = 'terrain'
        and s.geom && c.geom
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
          and s.geom && c.geom
          and extensions.st_intersects(s.geom, c.geom)
        group by s.land_cover_group
      ) as grouped
    ), '{}'::jsonb),
    land_cover_queried = exists (select 1 from public.official_physical_summaries where summary_class = 'land_cover'),
    land_cover_provider_key = case
      when exists (
        select 1
        from public.official_physical_summaries as s
        join public.grid_sources as gs on gs.id = s.source_id
        where s.summary_class = 'land_cover' and gs.slug = 'nv-nmd-2023'
      ) then 'nv-nmd-2023'
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
      'targetFit', c.target_fit_label,
      'gridContextNote', 'Official covering geography is not available connection capacity.'
    )
  where c.run_id = p_run_id
    and c.candidate_kind = 'site';

  select count(*)::int into v_after
  from public.opportunity_run_candidates
  where run_id = p_run_id and candidate_kind = 'site';

  update public.opportunity_search_runs
  set
    ranking_version = 'suitability-v4',
    methodology_version = 'site-generation-v2.1',
    methodology = 'site-generation-v2.1: opportunity zones from dissolved remaining geography; candidate sites region-grown from 150 m eligible land units toward the configured target. Target is a preference, not a cookie cutter. Extra hectares above target do not dominate ranking. Official covering geography is not available capacity.',
    returned_count = v_after,
    provider_availability = coalesce(provider_availability, '{}'::jsonb) || jsonb_build_object(
      'nv-nmd-2023', exists (
        select 1
        from public.official_physical_summaries as s
        join public.grid_sources as gs on gs.id = s.source_id
        where s.summary_class = 'land_cover' and gs.slug = 'nv-nmd-2023'
      ),
      'nv-nmd-2018', exists (
        select 1
        from public.official_physical_summaries as s
        join public.grid_sources as gs on gs.id = s.source_id
        where s.summary_class = 'land_cover' and gs.slug = 'nv-nmd-2018'
      )
    ),
    operational_metrics = coalesce(operational_metrics, '{}'::jsonb) || jsonb_build_object(
      'siteGeneration', jsonb_build_object(
        'version', 'site-generation-v2.1',
        'zoneCount', v_zones,
        'unitCount', v_seeds,
        'seedAttempts', v_attempts,
        'beforeDedupe', v_before,
        'afterDedupe', v_after,
        'minHa', v_min,
        'targetHa', v_target,
        'maxHa', v_max,
        'dedupeIou', 0.5,
        'cellM', v_cell_m
      )
    )
  where id = p_run_id;

  zone_count := v_zones;
  site_count := v_after;
  seed_count := v_attempts;
  before_dedupe := v_before;
  after_dedupe := v_after;
  duration_ms := greatest(1, floor(extract(epoch from (clock_timestamp() - v_started)) * 1000)::integer);
  return next;
end;
$$;

revoke all on function public.segment_opportunity_run_into_sites(uuid) from public, anon;
grant execute on function public.segment_opportunity_run_into_sites(uuid) to authenticated, service_role;
grant execute on function private.land_cover_pref_score(text, jsonb) to postgres, service_role;

-- Screening RPCs grow land units; PostgREST inherits authenticator/authenticated timeouts.
alter role authenticator set statement_timeout = '10min';
alter role authenticated set statement_timeout = '10min';
