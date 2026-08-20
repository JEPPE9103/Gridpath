-- Official Ei local-network concession matching (PostGIS geography).
-- grid_areas already has unique (source_id, external_id) WHERE external_id IS NOT NULL
-- from 20260820184500_grid_intelligence_foundation.sql. Do not duplicate it.
--
-- This data is NETWORK AREA / CONCESSION CONTEXT only.
-- It does not represent capacity, connection outlook, or feasibility.

create or replace function private.normalize_sweref99tm_multipolygons(p_wkts text[])
returns extensions.geometry
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  result extensions.geometry;
begin
  select
    case
      when normalized is null or extensions.st_isempty(normalized) then null
      else extensions.st_multi(
        extensions.st_collectionextract(extensions.st_makevalid(normalized), 3)
      )::extensions.geometry
    end
  into result
  from (
    select
      extensions.st_transform(
        extensions.st_unaryunion(
          extensions.st_collect(src.geom)
        ),
        4326
      ) as normalized
    from (
      select
        extensions.st_makevalid(
          extensions.st_force2d(
            extensions.st_setsrid(extensions.st_geomfromtext(wkt), 3006)
          )
        ) as geom
      from unnest(p_wkts) as wkt
      where wkt is not null
        and length(trim(wkt)) > 0
    ) as src
    where src.geom is not null
      and not extensions.st_isempty(src.geom)
  ) as transformed
  where transformed.normalized is not null;

  if result is null or extensions.st_isempty(result) then
    return null;
  end if;

  return result;
exception
  when others then
    return null;
end;
$$;

comment on function private.normalize_sweref99tm_multipolygons(text[]) is
  'Internal: SWEREF99 TM / EPSG:3006 WKT polygons → valid MultiPolygon 4326. Not a public RPC.';

revoke all on function private.normalize_sweref99tm_multipolygons(text[]) from public, anon, authenticated;

create or replace function private.ei_local_network_areas_covering_geom(p_geom extensions.geometry)
returns setof public.grid_areas
language sql
stable
security definer
set search_path = ''
as $$
  select ga.*
  from public.grid_areas as ga
  inner join public.grid_sources as gs
    on gs.id = ga.source_id
  where gs.slug = 'ei-network-area-concessions'
    and gs.authority_level = 'official'
    and gs.active
    and ga.area_type = 'local_network'
    and ga.country_code = 'SE'
    and ga.geometry is not null
    and p_geom is not null
    and extensions.st_isvalid(ga.geometry)
    and extensions.st_covers(
      ga.geometry::extensions.geography,
      p_geom::extensions.geography
    )
  order by extensions.st_area(ga.geometry::extensions.geography) asc, ga.external_id asc;
$$;

comment on function private.ei_local_network_areas_covering_geom(extensions.geometry) is
  'Internal: official Ei local-network concession areas covering a WGS84 point via ST_Covers on geography. Not a public RPC. Not capacity data.';

revoke all on function private.ei_local_network_areas_covering_geom(extensions.geometry)
  from public, anon, authenticated;

create or replace function public.get_official_grid_area_context_for_project(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if p_project_id is null then
    return null;
  end if;

  if not private.belongs_to_project_organization(p_project_id) then
    return null;
  end if;

  select
    jsonb_build_object(
      'project', jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'slug', p.slug,
        'gridOperatorName', go.name
      ),
      'coordinate', case
        when ps.geom is null then null
        else jsonb_build_object(
          'longitude', extensions.st_x(ps.geom),
          'latitude', extensions.st_y(ps.geom)
        )
      end,
      'areas', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', area.id,
            'name', area.name,
            'areaType', area.area_type,
            'officialOperatorName', area.metadata ->> 'official_operator_name',
            'concessionId', area.external_id,
            'unitId', area.metadata ->> 'unit_id',
            'permittedVoltageKv',
              case
                when (area.metadata ->> 'permitted_voltage_kv') ~ '^-?[0-9]+(\.[0-9]+)?$'
                  then (area.metadata ->> 'permitted_voltage_kv')::numeric
                else null
              end
          )
          order by extensions.st_area(area.geometry::extensions.geography) asc, area.external_id asc
        )
        from private.ei_local_network_areas_covering_geom(ps.geom) as area
      ), '[]'::jsonb),
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
          'confidence', 'high',
          'dataType', 'Network area concession geography'
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
        where gs.slug = 'ei-network-area-concessions'
        limit 1
      )
    )
  into result
  from public.projects as p
  left join public.grid_operators as go
    on go.id = p.grid_operator_id
  left join public.project_sites as ps
    on ps.project_id = p.id
   and ps.is_primary
  where p.id = p_project_id;

  return result;
end;
$$;

comment on function public.get_official_grid_area_context_for_project(uuid) is
  'Official Ei local-network concession context for a project primary site. Org-scoped. Not capacity, outlook, or feasibility.';

revoke all on function public.get_official_grid_area_context_for_project(uuid) from public, anon;
grant execute on function public.get_official_grid_area_context_for_project(uuid) to authenticated;
