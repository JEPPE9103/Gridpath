-- Speed official covering lookups so map spatial matches stay under statement timeout.
-- Same ST_Covers(geography) predicate; add OPERATOR(extensions.&&) so the GIST index can filter.
-- Spatial matches must not ORDER BY the jsonb payload (that re-ran covering twice).

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
    and ga.geometry operator(extensions.&&) p_geom
    and extensions.st_covers(
      ga.geometry::extensions.geography,
      p_geom::extensions.geography
    )
  order by extensions.st_area(ga.geometry::extensions.geography) asc, ga.external_id asc;
$$;

comment on function private.ei_local_network_areas_covering_geom(extensions.geometry) is
  'Internal: official Ei local-network concession areas covering a WGS84 point via ST_Covers on geography. Bounding-box filter is an index aid only. Not a public RPC. Not capacity data.';

revoke all on function private.ei_local_network_areas_covering_geom(extensions.geometry)
  from public, anon, authenticated;

create or replace function private.ei_nup_planning_areas_covering_geom(p_geom extensions.geometry)
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
  where gs.slug = 'ei-network-development-plans'
    and gs.authority_level = 'official'
    and gs.active
    and ga.area_type = 'planning_area'
    and ga.country_code = 'SE'
    and ga.geometry is not null
    and p_geom is not null
    and extensions.st_isvalid(ga.geometry)
    and ga.geometry operator(extensions.&&) p_geom
    and extensions.st_covers(
      ga.geometry::extensions.geography,
      p_geom::extensions.geography
    )
  order by extensions.st_area(ga.geometry::extensions.geography) asc, ga.external_id asc;
$$;

comment on function private.ei_nup_planning_areas_covering_geom(extensions.geometry) is
  'Internal: official Ei NUP planning_area polygons covering a WGS84 point via ST_Covers on geography. Distinct from local_network concession matching. Bounding-box filter is an index aid only. Not capacity data.';

revoke all on function private.ei_nup_planning_areas_covering_geom(extensions.geometry)
  from public, anon, authenticated;

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
    select jsonb_agg(
      jsonb_build_object(
        'projectId', matched.project_id,
        'localAreaId', matched.local_area_id,
        'nupAreaId', matched.nup_area_id
      )
      order by matched.project_id
    )
    from (
      select
        p.id as project_id,
        local_area.id as local_area_id,
        nup_area.id as nup_area_id
      from public.projects as p
      inner join public.project_sites as ps
        on ps.project_id = p.id
       and ps.is_primary
      left join lateral (
        select area.id
        from private.ei_local_network_areas_covering_geom(ps.geom) as area
        limit 1
      ) as local_area on true
      left join lateral (
        select area.id
        from private.ei_nup_planning_areas_covering_geom(ps.geom) as area
        limit 1
      ) as nup_area on true
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
