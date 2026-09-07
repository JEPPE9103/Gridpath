-- Spatial official Grid Intelligence for the portfolio map.
-- Reuses grid_areas.geometry (MultiPolygon, 4326) and existing covering helpers.
-- Returns simplified GeoJSON only. Never raw source_snapshots or ingest payloads.
-- NUP values remain forecast transfer-capacity NEED, not available capacity.

create or replace function private.official_map_simplify_tolerance(p_zoom double precision)
returns double precision
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_zoom is null or p_zoom < 6 then 0.02
    when p_zoom < 9 then 0.008
    else 0.002
  end;
$$;

comment on function private.official_map_simplify_tolerance(double precision) is
  'Internal: zoom → ST_SimplifyPreserveTopology tolerance in degrees. Not a public RPC.';

revoke all on function private.official_map_simplify_tolerance(double precision) from public, anon, authenticated;

create or replace function private.official_map_simplified_geom(
  p_geom extensions.geometry,
  p_tolerance double precision
)
returns extensions.geometry
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when simplified is null or extensions.st_isempty(simplified) then p_geom
    else simplified
  end
  from (
    select extensions.st_multi(
      extensions.st_collectionextract(
        extensions.st_makevalid(
          extensions.st_simplifypreservetopology(p_geom, greatest(coalesce(p_tolerance, 0.02), 0.0005))
        ),
        3
      )
    ) as simplified
  ) as prepared;
$$;

comment on function private.official_map_simplified_geom(extensions.geometry, double precision) is
  'Internal: topology-preserving simplify with original-geom fallback. Not a public RPC.';

revoke all on function private.official_map_simplified_geom(extensions.geometry, double precision)
  from public, anon, authenticated;

create or replace function private.official_map_bbox(
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision
)
returns extensions.geometry
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  west double precision;
  south double precision;
  east double precision;
  north double precision;
begin
  west := least(greatest(coalesce(p_west, 10.3), -20), 40);
  south := least(greatest(coalesce(p_south, 55.0), 40), 72);
  east := least(greatest(coalesce(p_east, 24.6), -20), 40);
  north := least(greatest(coalesce(p_north, 69.4), 40), 72);
  if west >= east or south >= north then
    west := 10.3;
    south := 55.0;
    east := 24.6;
    north := 69.4;
  end if;
  return extensions.st_makeenvelope(west, south, east, north, 4326);
end;
$$;

comment on function private.official_map_bbox(double precision, double precision, double precision, double precision) is
  'Internal: clamp map envelope to a Northern-Europe window. Not a public RPC.';

revoke all on function private.official_map_bbox(double precision, double precision, double precision, double precision)
  from public, anon, authenticated;

create or replace function public.get_official_map_layer_geojson(
  p_layer text,
  p_west double precision,
  p_south double precision,
  p_east double precision,
  p_north double precision,
  p_zoom double precision
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  layer_slug text;
  layer_type text;
  bbox extensions.geometry;
  tolerance double precision;
  result jsonb;
begin
  if p_layer = 'local_network' then
    layer_slug := 'ei-network-area-concessions';
    layer_type := 'local_network';
  elsif p_layer = 'planning_area' then
    layer_slug := 'ei-network-development-plans';
    layer_type := 'planning_area';
  else
    return jsonb_build_object(
      'type', 'FeatureCollection',
      'features', '[]'::jsonb,
      'truncated', false,
      'featureCount', 0
    );
  end if;

  bbox := private.official_map_bbox(p_west, p_south, p_east, p_north);
  tolerance := private.official_map_simplify_tolerance(p_zoom);

  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce((
      select jsonb_agg(feature_row.feature)
      from (
        select jsonb_build_object(
          'type', 'Feature',
          'id', ga.id,
          'geometry', extensions.st_asgeojson(
            private.official_map_simplified_geom(ga.geometry, tolerance)
          )::jsonb,
          'properties', jsonb_build_object(
            'id', ga.id,
            'name', ga.name,
            'layer', p_layer,
            'areaType', ga.area_type,
            'officialOperatorName', ga.metadata ->> 'official_operator_name',
            'externalId', ga.external_id,
            'concessionId', case when p_layer = 'local_network' then ga.external_id else null end,
            'accountingUnit', ga.metadata ->> 'accounting_unit',
            'delomrade', ga.metadata ->> 'delomrade'
          )
        ) as feature
        from public.grid_areas as ga
        inner join public.grid_sources as gs
          on gs.id = ga.source_id
        where gs.slug = layer_slug
          and gs.authority_level = 'official'
          and gs.active
          and ga.area_type = layer_type
          and ga.country_code = 'SE'
          and ga.geometry is not null
          and extensions.st_isvalid(ga.geometry)
          and extensions.st_intersects(ga.geometry, bbox)
        order by extensions.st_area(ga.geometry::extensions.geography) desc, ga.external_id asc
        limit 600
      ) as feature_row
    ), '[]'::jsonb),
    'truncated', (
      select count(*) > 600
      from public.grid_areas as ga
      inner join public.grid_sources as gs
        on gs.id = ga.source_id
      where gs.slug = layer_slug
        and gs.authority_level = 'official'
        and gs.active
        and ga.area_type = layer_type
        and ga.country_code = 'SE'
        and ga.geometry is not null
        and extensions.st_intersects(ga.geometry, bbox)
    ),
    'featureCount', (
      select count(*)::int
      from public.grid_areas as ga
      inner join public.grid_sources as gs
        on gs.id = ga.source_id
      where gs.slug = layer_slug
        and gs.authority_level = 'official'
        and gs.active
        and ga.area_type = layer_type
        and ga.country_code = 'SE'
        and ga.geometry is not null
        and extensions.st_intersects(ga.geometry, bbox)
    ),
    'provenance', (
      select jsonb_build_object(
        'sourceId', gs.id,
        'sourceName', gs.name,
        'sourceSlug', gs.slug,
        'publisher', gs.publisher,
        'sourceUrl', gs.base_url,
        'publishedAt', latest.published_at,
        'retrievedAt', latest.retrieved_at,
        'authorityLevel', gs.authority_level,
        'dataType', case
          when p_layer = 'planning_area'
            then 'Network development plan (forecast need, not available capacity)'
          else 'Network area concession geography'
        end
      )
      from public.grid_sources as gs
      left join lateral (
        select ss.published_at, ss.retrieved_at
        from public.source_snapshots as ss
        where ss.source_id = gs.id
          and ss.status in ('success', 'unchanged')
        order by ss.retrieved_at desc
        limit 1
      ) as latest on true
      where gs.slug = layer_slug
      limit 1
    )
  )
  into result;

  return result;
end;
$$;

comment on function public.get_official_map_layer_geojson(text, double precision, double precision, double precision, double precision, double precision) is
  'Simplified official Ei GeoJSON for the portfolio map. Authenticated. No raw ingest payloads. Not capacity data.';

revoke all on function public.get_official_map_layer_geojson(text, double precision, double precision, double precision, double precision, double precision)
  from public, anon;
grant execute on function public.get_official_map_layer_geojson(text, double precision, double precision, double precision, double precision, double precision)
  to authenticated;

create or replace function public.get_official_covering_geojson_for_project(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_project_id is null or not private.belongs_to_project_organization(p_project_id) then
    return null;
  end if;

  select jsonb_build_object(
    'localNetwork', (
      select jsonb_build_object(
        'type', 'Feature',
        'id', area.id,
        'geometry', extensions.st_asgeojson(
          private.official_map_simplified_geom(area.geometry, 0.002)
        )::jsonb,
        'properties', jsonb_build_object(
          'id', area.id,
          'name', area.name,
          'layer', 'local_network',
          'areaType', area.area_type,
          'officialOperatorName', area.metadata ->> 'official_operator_name',
          'externalId', area.external_id
        )
      )
      from private.ei_local_network_areas_covering_geom(ps.geom) as area
      limit 1
    ),
    'planningArea', (
      select jsonb_build_object(
        'type', 'Feature',
        'id', area.id,
        'geometry', extensions.st_asgeojson(
          private.official_map_simplified_geom(area.geometry, 0.002)
        )::jsonb,
        'properties', jsonb_build_object(
          'id', area.id,
          'name', area.name,
          'layer', 'planning_area',
          'areaType', area.area_type,
          'officialOperatorName', area.metadata ->> 'official_operator_name',
          'externalId', area.external_id
        )
      )
      from private.ei_nup_planning_areas_covering_geom(ps.geom) as area
      limit 1
    )
  )
  into result
  from public.project_sites as ps
  where ps.project_id = p_project_id
    and ps.is_primary
  limit 1;

  return coalesce(
    result,
    jsonb_build_object('localNetwork', null, 'planningArea', null)
  );
end;
$$;

comment on function public.get_official_covering_geojson_for_project(uuid) is
  'Org-scoped covering official polygons for a project primary site. Geographic covering, not a connection point.';

revoke all on function public.get_official_covering_geojson_for_project(uuid) from public, anon;
grant execute on function public.get_official_covering_geojson_for_project(uuid) to authenticated;

create or replace function public.get_organization_official_spatial_matches(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_organization_id is null or not private.belongs_to_organization(p_organization_id) then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(row_payload order by row_payload ->> 'projectId')
    from (
      select jsonb_build_object(
        'projectId', p.id,
        'localAreaId', (
          select area.id
          from private.ei_local_network_areas_covering_geom(ps.geom) as area
          limit 1
        ),
        'nupAreaId', (
          select area.id
          from private.ei_nup_planning_areas_covering_geom(ps.geom) as area
          limit 1
        )
      ) as row_payload
      from public.projects as p
      inner join public.project_sites as ps
        on ps.project_id = p.id
       and ps.is_primary
      where p.organization_id = p_organization_id
        and p.archived_at is null
        and ps.geom is not null
    ) as matched
  ), '[]'::jsonb);
end;
$$;

comment on function public.get_organization_official_spatial_matches(uuid) is
  'Active-project official covering ids for the current organisation. Archived excluded. Not a grid score.';

revoke all on function public.get_organization_official_spatial_matches(uuid) from public, anon;
grant execute on function public.get_organization_official_spatial_matches(uuid) to authenticated;

create or replace function public.get_official_map_area_context(
  p_area_id uuid,
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  org_ok boolean;
begin
  if p_area_id is null then
    return null;
  end if;

  org_ok := p_organization_id is not null and private.belongs_to_organization(p_organization_id);

  select jsonb_build_object(
    'id', ga.id,
    'name', ga.name,
    'layer', case
      when gs.slug = 'ei-network-area-concessions' then 'local_network'
      when gs.slug = 'ei-network-development-plans' then 'planning_area'
      else null
    end,
    'areaType', ga.area_type,
    'officialOperatorName', ga.metadata ->> 'official_operator_name',
    'externalId', ga.external_id,
    'concessionId', case
      when gs.slug = 'ei-network-area-concessions' then ga.external_id
      else null
    end,
    'accountingUnit', ga.metadata ->> 'accounting_unit',
    'delomrade', ga.metadata ->> 'delomrade',
    'publishedAt', ga.published_at,
    'retrievedAt', ga.retrieved_at,
    'projectCount', case
      when org_ok then (
        select count(*)::int
        from public.projects as p
        inner join public.project_sites as ps
          on ps.project_id = p.id
         and ps.is_primary
        where p.organization_id = p_organization_id
          and p.archived_at is null
          and ps.geom is not null
          and extensions.st_covers(
            ga.geometry::extensions.geography,
            ps.geom::extensions.geography
          )
      )
      else null
    end,
    'forecastTransferCapacityNeed', case
      when gs.slug = 'ei-network-development-plans' then coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'year', (obs.raw_metadata ->> 'planning_year')::int,
            'valueNumeric', obs.value_numeric,
            'valueText', obs.value_text,
            'unit', obs.unit,
            'representation', obs.raw_metadata ->> 'representation'
          )
          order by (obs.raw_metadata ->> 'planning_year')::int
        )
        from public.grid_observations as obs
        where obs.grid_area_id = ga.id
          and obs.source_id = ga.source_id
          and obs.observation_type = 'capacity_signal'
          and obs.raw_metadata ->> 'semantic' = 'forecast_transfer_capacity_need'
      ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'provenance', jsonb_build_object(
      'sourceId', gs.id,
      'sourceName', gs.name,
      'sourceSlug', gs.slug,
      'publisher', gs.publisher,
      'sourceUrl', gs.base_url,
      'publishedAt', latest.published_at,
      'retrievedAt', latest.retrieved_at,
      'authorityLevel', gs.authority_level,
      'dataType', case
        when gs.slug = 'ei-network-development-plans'
          then 'Network development plan (forecast need, not available capacity)'
        else 'Network area concession geography'
      end,
      'planningPeriod', latest.metadata ->> 'planning_period'
    )
  )
  into result
  from public.grid_areas as ga
  inner join public.grid_sources as gs
    on gs.id = ga.source_id
  left join lateral (
    select ss.published_at, ss.retrieved_at, ss.metadata
    from public.source_snapshots as ss
    where ss.source_id = gs.id
      and ss.status in ('success', 'unchanged')
    order by ss.retrieved_at desc
    limit 1
  ) as latest on true
  where ga.id = p_area_id
    and gs.authority_level = 'official'
    and gs.active
    and gs.slug in ('ei-network-area-concessions', 'ei-network-development-plans');

  return result;
end;
$$;

comment on function public.get_official_map_area_context(uuid, uuid) is
  'Official map polygon inspector. Org projectCount only when the caller belongs to p_organization_id. No raw snapshots.';

revoke all on function public.get_official_map_area_context(uuid, uuid) from public, anon;
grant execute on function public.get_official_map_area_context(uuid, uuid) to authenticated;
