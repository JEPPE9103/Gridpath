-- Ei Nätutvecklingsplaner (NUP) observation identity + planning-area matching.
-- grid_areas unique (source_id, external_id) from 20260820184500 is sufficient
-- for planning_area rows under a distinct grid_sources slug.
--
-- NUP planning_area polygons are NOT concession / local_network areas.
-- Forecast MW is forecast transfer-capacity NEED, never available capacity.

create unique index if not exists grid_observations_source_external_id_uidx
  on public.grid_observations (source_id, external_id)
  where external_id is not null;

comment on index public.grid_observations_source_external_id_uidx is
  'Deterministic observation identity per source. Partial so fixture rows without external_id remain allowed.';

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
    and extensions.st_covers(
      ga.geometry::extensions.geography,
      p_geom::extensions.geography
    )
  order by extensions.st_area(ga.geometry::extensions.geography) asc, ga.external_id asc;
$$;

comment on function private.ei_nup_planning_areas_covering_geom(extensions.geometry) is
  'Internal: official Ei NUP planning_area polygons covering a WGS84 point via ST_Covers on geography. Distinct from local_network concession matching. Not capacity data.';

revoke all on function private.ei_nup_planning_areas_covering_geom(extensions.geometry)
  from public, anon, authenticated;

create or replace function public.get_official_network_development_plan_context_for_project(p_project_id uuid)
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
      'planningAreas', coalesce((
        select jsonb_agg(area_payload order by area_ord)
        from (
          select
            jsonb_build_object(
              'id', area.id,
              'name', area.name,
              'areaType', area.area_type,
              'officialOperatorName', area.metadata ->> 'official_operator_name',
              'organizationNumber', area.metadata ->> 'organization_number',
              'accountingUnit', area.metadata ->> 'accounting_unit',
              'delomrade', area.metadata ->> 'delomrade',
              'externalId', area.external_id,
              'observations', jsonb_build_object(
                'forecastTransferCapacityNeed', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'year', (obs.raw_metadata ->> 'planning_year')::int,
                      'valueNumeric', obs.value_numeric,
                      'valueText', obs.value_text,
                      'unit', obs.unit,
                      'representation', obs.raw_metadata ->> 'representation',
                      'semantic', obs.raw_metadata ->> 'semantic'
                    )
                    order by (obs.raw_metadata ->> 'planning_year')::int
                  )
                  from public.grid_observations as obs
                  where obs.grid_area_id = area.id
                    and obs.source_id = area.source_id
                    and obs.observation_type = 'capacity_signal'
                    and obs.raw_metadata ->> 'semantic' = 'forecast_transfer_capacity_need'
                ), '[]'::jsonb),
                'plannedInvestments', (
                  select jsonb_build_object(
                    'valueText', obs.value_text,
                    'semantic', obs.raw_metadata ->> 'semantic'
                  )
                  from public.grid_observations as obs
                  where obs.grid_area_id = area.id
                    and obs.source_id = area.source_id
                    and obs.observation_type = 'reinforcement'
                    and obs.raw_metadata ->> 'semantic' = 'planned_investments_reported'
                  order by obs.external_id
                  limit 1
                ),
                'flexibilityNeed', coalesce((
                  select jsonb_agg(
                    jsonb_build_object(
                      'horizon', obs.raw_metadata ->> 'horizon',
                      'valueNumeric', obs.value_numeric,
                      'valueText', obs.value_text,
                      'unit', obs.unit,
                      'semantic', obs.raw_metadata ->> 'semantic'
                    )
                    order by obs.raw_metadata ->> 'horizon'
                  )
                  from public.grid_observations as obs
                  where obs.grid_area_id = area.id
                    and obs.source_id = area.source_id
                    and obs.observation_type = 'other'
                    and obs.raw_metadata ->> 'semantic' = 'flexibility_need'
                ), '[]'::jsonb),
                'plannedMeasuresMeetOwnNetworkNeed', (
                  select jsonb_build_object(
                    'valueText', obs.value_text,
                    'semantic', obs.raw_metadata ->> 'semantic'
                  )
                  from public.grid_observations as obs
                  where obs.grid_area_id = area.id
                    and obs.source_id = area.source_id
                    and obs.observation_type = 'constraint'
                    and obs.raw_metadata ->> 'semantic' = 'planned_measures_meet_own_network_need'
                  order by obs.external_id
                  limit 1
                ),
                'overlyingNetworkLimitation', (
                  select jsonb_build_object(
                    'valueText', obs.value_text,
                    'semantic', obs.raw_metadata ->> 'semantic'
                  )
                  from public.grid_observations as obs
                  where obs.grid_area_id = area.id
                    and obs.source_id = area.source_id
                    and obs.observation_type = 'constraint'
                    and obs.raw_metadata ->> 'semantic' = 'overlying_network_limitation'
                  order by obs.external_id
                  limit 1
                )
              )
            ) as area_payload,
            row_number() over (
              order by extensions.st_area(area.geometry::extensions.geography) asc, area.external_id asc
            ) as area_ord
          from private.ei_nup_planning_areas_covering_geom(ps.geom) as area
        ) as ranked
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
          'dataType', 'Network development plan (forecast need, not available capacity)',
          'sourceType', gs.source_type,
          'planningPeriod', latest.metadata ->> 'planning_period',
          'datasetUpdate', latest.metadata ->> 'workbook_modified'
        )
        from public.grid_sources as gs
        left join lateral (
          select ss.published_at, ss.retrieved_at, ss.metadata
          from public.source_snapshots as ss
          where ss.source_id = gs.id
            and ss.status in ('success', 'unchanged')
          order by ss.retrieved_at desc
          limit 1
        ) as latest on true
        where gs.slug = 'ei-network-development-plans'
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

comment on function public.get_official_network_development_plan_context_for_project(uuid) is
  'Official Ei NUP planning-area context for a project primary site. Org-scoped. Forecast values are transfer-capacity NEED, not available MW, headroom, or feasibility.';

revoke all on function public.get_official_network_development_plan_context_for_project(uuid) from public, anon;
grant execute on function public.get_official_network_development_plan_context_for_project(uuid) to authenticated;
