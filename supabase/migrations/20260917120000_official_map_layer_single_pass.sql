-- Faster official map GeoJSON: one geometry pass instead of features + two COUNT scans.
-- Additive index for authenticated search-run lookups by organisation.

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

  with matched as (
    select
      ga.id,
      ga.name,
      ga.area_type,
      ga.external_id,
      ga.metadata,
      private.official_map_simplified_geom(ga.geometry, tolerance) as geom
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
    limit 601
  ),
  numbered as (
    select matched.*, row_number() over () as ord
    from matched
  ),
  capped as (
    select *
    from numbered
    where ord <= 600
  )
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce((
      select jsonb_agg(feature_row.feature order by feature_row.ord)
      from (
        select
          capped.ord,
          jsonb_build_object(
          'type', 'Feature',
          'id', capped.id,
          'geometry', extensions.st_asgeojson(capped.geom)::jsonb,
          'properties', jsonb_build_object(
            'id', capped.id,
            'name', capped.name,
            'layer', p_layer,
            'areaType', capped.area_type,
            'officialOperatorName', capped.metadata ->> 'official_operator_name',
            'externalId', capped.external_id,
            'concessionId', case when p_layer = 'local_network' then capped.external_id else null end,
            'accountingUnit', capped.metadata ->> 'accounting_unit',
            'delomrade', capped.metadata ->> 'delomrade'
          )
        ) as feature
        from capped
      ) as feature_row
    ), '[]'::jsonb),
    'truncated', (select count(*) from matched) > 600,
    'featureCount', (select count(*)::int from capped),
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

create index if not exists opportunity_search_runs_organization_id_idx
  on public.opportunity_search_runs (organization_id);
