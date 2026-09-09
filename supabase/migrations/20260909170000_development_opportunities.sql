-- Development Intelligence: opportunities exist before projects.
-- Additive schema. Does not estimate available grid capacity.

create table public.opportunity_searches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  name text,
  technology text not null,
  country text not null default 'SE',
  region text,
  municipality text,
  target_mw numeric,
  target_mwh numeric,
  min_site_area_ha numeric,
  max_distance_km numeric,
  exclude_protected boolean not null default false,
  exclude_natura boolean not null default false,
  max_slope_percent numeric,
  min_distance_residential_m numeric,
  notes text,
  criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint opportunity_searches_technology_check check (
    technology in (
      'battery_storage', 'solar', 'wind', 'hybrid', 'data_center',
      'ev_infrastructure', 'industrial', 'hydrogen', 'other'
    )
  )
);

create table public.development_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  screening_search_id uuid references public.opportunity_searches (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  owner_id uuid references public.profiles (id) on delete set null,
  name text not null,
  slug text not null,
  opportunity_type text not null default 'battery_storage',
  status text not null default 'identified',
  country text not null default 'SE',
  region text,
  municipality text,
  latitude double precision,
  longitude double precision,
  geom extensions.geometry(Point, 4326),
  target_mw numeric,
  target_mwh numeric,
  site_area_ha numeric,
  notes text,
  recommendation text not null default 'insufficient_evidence',
  recommendation_summary text,
  key_positive text,
  key_risk text,
  data_confidence text not null default 'unknown',
  rejection_reason text,
  rejection_note text,
  rejected_at timestamptz,
  rejected_by uuid references public.profiles (id) on delete set null,
  promoted_project_id uuid references public.projects (id) on delete set null,
  promoted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint development_opportunities_org_slug_key unique (organization_id, slug),
  constraint development_opportunities_type_check check (
    opportunity_type in (
      'battery_storage', 'solar', 'wind', 'hybrid', 'data_center',
      'ev_infrastructure', 'industrial', 'hydrogen', 'other'
    )
  ),
  constraint development_opportunities_status_check check (
    status in (
      'identified', 'screening', 'strong_candidate', 'under_review',
      'shortlisted', 'promoted', 'rejected'
    )
  ),
  constraint development_opportunities_recommendation_check check (
    recommendation in (
      'prioritise', 'investigate', 'secondary', 'low_priority', 'insufficient_evidence'
    )
  ),
  constraint development_opportunities_confidence_check check (
    data_confidence in ('high', 'medium', 'low', 'unknown')
  ),
  constraint development_opportunities_reject_reason_check check (
    rejection_reason is null or rejection_reason in (
      'grid', 'environmental', 'land', 'planning', 'economics',
      'access', 'strategic_fit', 'duplicate', 'other'
    )
  ),
  constraint development_opportunities_mw_check check (target_mw is null or target_mw >= 0),
  constraint development_opportunities_mwh_check check (target_mwh is null or target_mwh >= 0),
  constraint development_opportunities_area_check check (site_area_ha is null or site_area_ha >= 0)
);

create index development_opportunities_org_updated_idx
  on public.development_opportunities (organization_id, updated_at desc);

create index development_opportunities_org_status_idx
  on public.development_opportunities (organization_id, status);

create index development_opportunities_geom_idx
  on public.development_opportunities using gist (geom)
  where geom is not null;

create table public.opportunity_assessments (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.development_opportunities (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  dimension text not null,
  result text not null,
  explanation text not null,
  source_kind text not null,
  completeness text not null,
  provider_key text,
  evidence jsonb not null default '{}'::jsonb,
  assessed_at timestamptz not null default now(),
  constraint opportunity_assessments_dimension_key unique (opportunity_id, dimension),
  constraint opportunity_assessments_dimension_check check (
    dimension in (
      'grid_context', 'grid_proximity', 'land_suitability',
      'environmental', 'planning', 'access', 'strategic_fit'
    )
  ),
  constraint opportunity_assessments_result_check check (
    result in ('strong', 'moderate', 'low_conflict', 'review_required', 'unavailable', 'excluded')
  ),
  constraint opportunity_assessments_source_check check (
    source_kind in ('customer_data', 'official', 'noxheim_derived')
  ),
  constraint opportunity_assessments_completeness_check check (
    completeness in ('available', 'insufficient')
  )
);

create table public.opportunity_events (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.development_opportunities (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  detail text,
  source text not null default 'Customer Data',
  occurred_at timestamptz not null default now()
);

create index opportunity_events_opportunity_occurred_idx
  on public.opportunity_events (opportunity_id, occurred_at desc);

alter table public.projects
  add column if not exists originating_opportunity_id uuid references public.development_opportunities (id) on delete set null;

create unique index if not exists projects_originating_opportunity_unique
  on public.projects (originating_opportunity_id)
  where originating_opportunity_id is not null;

alter table public.opportunity_searches enable row level security;
alter table public.opportunity_searches force row level security;
alter table public.development_opportunities enable row level security;
alter table public.development_opportunities force row level security;
alter table public.opportunity_assessments enable row level security;
alter table public.opportunity_assessments force row level security;
alter table public.opportunity_events enable row level security;
alter table public.opportunity_events force row level security;

revoke all on table public.opportunity_searches from public, anon;
revoke all on table public.development_opportunities from public, anon;
revoke all on table public.opportunity_assessments from public, anon;
revoke all on table public.opportunity_events from public, anon;

grant select, insert, update, delete on table public.opportunity_searches to authenticated;
grant select, insert, update, delete on table public.development_opportunities to authenticated;
grant select, insert, update, delete on table public.opportunity_assessments to authenticated;
grant select, insert, update, delete on table public.opportunity_events to authenticated;

create policy opportunity_searches_select_authenticated
  on public.opportunity_searches for select to authenticated
  using (private.belongs_to_organization(organization_id));

create policy opportunity_searches_insert_authenticated
  on public.opportunity_searches for insert to authenticated
  with check (private.can_write_organization(organization_id));

create policy opportunity_searches_update_authenticated
  on public.opportunity_searches for update to authenticated
  using (private.can_write_organization(organization_id))
  with check (private.can_write_organization(organization_id));

create policy opportunity_searches_delete_authenticated
  on public.opportunity_searches for delete to authenticated
  using (private.is_organization_admin(organization_id));

create policy development_opportunities_select_authenticated
  on public.development_opportunities for select to authenticated
  using (private.belongs_to_organization(organization_id));

create policy development_opportunities_insert_authenticated
  on public.development_opportunities for insert to authenticated
  with check (private.can_write_organization(organization_id));

create policy development_opportunities_update_authenticated
  on public.development_opportunities for update to authenticated
  using (private.can_write_organization(organization_id))
  with check (private.can_write_organization(organization_id));

create policy development_opportunities_delete_authenticated
  on public.development_opportunities for delete to authenticated
  using (private.is_organization_admin(organization_id));

create policy opportunity_assessments_select_authenticated
  on public.opportunity_assessments for select to authenticated
  using (private.belongs_to_organization(organization_id));

create policy opportunity_assessments_insert_authenticated
  on public.opportunity_assessments for insert to authenticated
  with check (private.can_write_organization(organization_id));

create policy opportunity_assessments_update_authenticated
  on public.opportunity_assessments for update to authenticated
  using (private.can_write_organization(organization_id))
  with check (private.can_write_organization(organization_id));

create policy opportunity_assessments_delete_authenticated
  on public.opportunity_assessments for delete to authenticated
  using (private.can_write_organization(organization_id));

create policy opportunity_events_select_authenticated
  on public.opportunity_events for select to authenticated
  using (private.belongs_to_organization(organization_id));

create policy opportunity_events_insert_authenticated
  on public.opportunity_events for insert to authenticated
  with check (private.can_write_organization(organization_id));

create policy opportunity_events_update_authenticated
  on public.opportunity_events for update to authenticated
  using (private.can_write_organization(organization_id))
  with check (private.can_write_organization(organization_id));

create policy opportunity_events_delete_authenticated
  on public.opportunity_events for delete to authenticated
  using (private.is_organization_admin(organization_id));

create or replace function public.allocate_opportunity_slug(
  p_organization_id uuid,
  p_name text,
  p_exclude_id uuid default null
)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_base text;
  v_slug text;
  v_n integer := 1;
begin
  v_base := public.slugify_project_name(p_name);
  if v_base = 'project' then
    v_base := 'opportunity';
  end if;
  v_slug := v_base;
  loop
    exit when not exists (
      select 1
      from public.development_opportunities as o
      where o.organization_id = p_organization_id
        and o.slug = v_slug
        and (p_exclude_id is null or o.id <> p_exclude_id)
    );
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  end loop;
  return v_slug;
end;
$$;

create or replace function public.create_development_opportunity(
  p_organization_id uuid,
  p_name text,
  p_opportunity_type text,
  p_country text default 'SE',
  p_region text default null,
  p_municipality text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_target_mw numeric default null,
  p_target_mwh numeric default null,
  p_site_area_ha numeric default null,
  p_notes text default null,
  p_screening_search_id uuid default null,
  p_recommendation text default 'insufficient_evidence',
  p_recommendation_summary text default null,
  p_data_confidence text default 'unknown',
  p_status text default 'identified'
)
returns table (opportunity_id uuid, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_role text;
  v_name text;
  v_slug text;
  v_id uuid;
  v_geom extensions.geometry;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select m.role into v_role
  from public.organization_members as m
  where m.profile_id = v_user_id
    and m.organization_id = p_organization_id;

  if v_role is null or v_role not in ('owner', 'admin', 'member') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  v_name := pg_catalog.btrim(coalesce(p_name, ''));
  if pg_catalog.char_length(v_name) = 0 then
    raise exception 'Opportunity name is required' using errcode = '22023';
  end if;

  if p_screening_search_id is not null and not exists (
    select 1
    from public.opportunity_searches as s
    where s.id = p_screening_search_id
      and s.organization_id = p_organization_id
  ) then
    raise exception 'Screening search not found' using errcode = '22023';
  end if;

  if p_latitude is not null and p_longitude is not null then
    if p_latitude < -90 or p_latitude > 90 or p_longitude < -180 or p_longitude > 180 then
      raise exception 'Invalid coordinates' using errcode = '22023';
    end if;
    v_geom := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326);
  end if;

  v_slug := public.allocate_opportunity_slug(p_organization_id, v_name, null);

  insert into public.development_opportunities (
    organization_id,
    screening_search_id,
    created_by,
    owner_id,
    name,
    slug,
    opportunity_type,
    status,
    country,
    region,
    municipality,
    latitude,
    longitude,
    geom,
    target_mw,
    target_mwh,
    site_area_ha,
    notes,
    recommendation,
    recommendation_summary,
    data_confidence
  ) values (
    p_organization_id,
    p_screening_search_id,
    v_user_id,
    v_user_id,
    v_name,
    v_slug,
    p_opportunity_type,
    coalesce(nullif(pg_catalog.btrim(p_status), ''), 'identified'),
    coalesce(nullif(pg_catalog.btrim(p_country), ''), 'SE'),
    nullif(pg_catalog.btrim(coalesce(p_region, '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_municipality, '')), ''),
    p_latitude,
    p_longitude,
    v_geom,
    p_target_mw,
    p_target_mwh,
    p_site_area_ha,
    nullif(pg_catalog.btrim(coalesce(p_notes, '')), ''),
    coalesce(nullif(pg_catalog.btrim(p_recommendation), ''), 'insufficient_evidence'),
    nullif(pg_catalog.btrim(coalesce(p_recommendation_summary, '')), ''),
    coalesce(nullif(pg_catalog.btrim(p_data_confidence), ''), 'unknown')
  )
  returning id into v_id;

  insert into public.opportunity_events (opportunity_id, organization_id, title, detail, source)
  values (
    v_id,
    p_organization_id,
    'Opportunity created',
    'Opportunity record was created from a screening search or manual entry.',
    'Customer Data'
  );

  opportunity_id := v_id;
  slug := v_slug;
  return next;
end;
$$;

create or replace function public.promote_opportunity_to_project(p_opportunity_id uuid)
returns table (project_id uuid, project_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_role text;
  v_opp public.development_opportunities%rowtype;
  v_tech text;
  v_project_id uuid;
  v_project_slug text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_opp
  from public.development_opportunities
  where id = p_opportunity_id;

  if v_opp.id is null then
    raise exception 'Opportunity not found' using errcode = '22023';
  end if;

  select m.role into v_role
  from public.organization_members as m
  where m.profile_id = v_user_id
    and m.organization_id = v_opp.organization_id;

  if v_role is null or v_role not in ('owner', 'admin', 'member') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_opp.promoted_project_id is not null or v_opp.status = 'promoted' then
    raise exception 'Opportunity already promoted' using errcode = '22023';
  end if;

  if v_opp.status = 'rejected' then
    raise exception 'Rejected opportunities cannot be promoted' using errcode = '22023';
  end if;

  if v_opp.latitude is null or v_opp.longitude is null then
    raise exception 'Coordinates required to promote' using errcode = '22023';
  end if;

  v_tech := case v_opp.opportunity_type
    when 'battery_storage' then 'battery_storage'
    when 'solar' then 'solar'
    when 'wind' then 'wind'
    when 'ev_infrastructure' then 'ev_infrastructure'
    when 'industrial' then 'industrial'
    when 'data_center' then 'industrial'
    else 'other'
  end;

  select created.project_id, created.slug
    into v_project_id, v_project_slug
  from public.create_project_with_primary_site(
    v_opp.organization_id,
    v_opp.name,
    v_tech,
    coalesce(v_opp.municipality, v_opp.region),
    v_opp.latitude,
    v_opp.longitude,
    v_opp.target_mw,
    v_opp.target_mw,
    null,
    'prospect',
    'unknown',
    case v_opp.data_confidence
      when 'high' then 'high'
      when 'medium' then 'medium'
      when 'low' then 'low'
      else 'unknown'
    end,
    null,
    concat_ws(
      e'\n\n',
      nullif(v_opp.notes, ''),
      'Promoted from Development Intelligence opportunity. Ranking is evidence-based screening, not a prediction of connection or project success.',
      v_opp.recommendation_summary
    ),
    v_opp.region,
    null
  ) as created;

  update public.projects
  set originating_opportunity_id = v_opp.id
  where id = v_project_id;

  update public.development_opportunities
  set
    status = 'promoted',
    promoted_project_id = v_project_id,
    promoted_at = now(),
    updated_at = now()
  where id = v_opp.id;

  insert into public.opportunity_events (opportunity_id, organization_id, title, detail, source)
  values (
    v_opp.id,
    v_opp.organization_id,
    'Promoted to project',
    'Opportunity converted to a NOXHEIM project. Connection workflow continues on the project.',
    'Customer Data'
  );

  insert into public.project_events (project_id, title, detail, source)
  values (
    v_project_id,
    'Promoted from opportunity',
    concat_ws(
      e'\n',
      'Created from a Development Intelligence opportunity. Ranking is evidence-based screening, not a prediction of connection or project success.',
      v_opp.recommendation_summary
    ),
    'NOXHEIM Analysis'
  );

  project_id := v_project_id;
  project_slug := v_project_slug;
  return next;
end;
$$;

create or replace function public.get_official_covering_summary_for_point(
  p_latitude double precision,
  p_longitude double precision
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_geom extensions.geometry;
  v_local_name text;
  v_nup_name text;
begin
  if auth.uid() is null then
    return null;
  end if;
  if p_latitude is null or p_longitude is null
    or p_latitude < -90 or p_latitude > 90
    or p_longitude < -180 or p_longitude > 180
  then
    return null;
  end if;

  v_geom := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326);

  select area.name
    into v_local_name
  from private.ei_local_network_areas_covering_geom(v_geom) as area
  order by extensions.st_area(area.geometry::extensions.geography) asc
  limit 1;

  select area.name
    into v_nup_name
  from private.ei_nup_planning_areas_covering_geom(v_geom) as area
  order by extensions.st_area(area.geometry::extensions.geography) asc
  limit 1;

  return jsonb_build_object(
    'queried', true,
    'localCovered', v_local_name is not null,
    'nupCovered', v_nup_name is not null,
    'localName', v_local_name,
    'nupName', v_nup_name,
    'retrievedAt', now(),
    'sourceName', 'Energimarknadsinspektionen',
    'disclaimer', 'Covering official geography is not available connection capacity.'
  );
end;
$$;

revoke all on function public.allocate_opportunity_slug(uuid, text, uuid) from public, anon;
revoke all on function public.create_development_opportunity(uuid, text, text, text, text, text, double precision, double precision, numeric, numeric, numeric, text, uuid, text, text, text, text) from public, anon;
revoke all on function public.promote_opportunity_to_project(uuid) from public, anon;
revoke all on function public.get_official_covering_summary_for_point(double precision, double precision) from public, anon;

grant execute on function public.allocate_opportunity_slug(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.create_development_opportunity(uuid, text, text, text, text, text, double precision, double precision, numeric, numeric, numeric, text, uuid, text, text, text, text) to authenticated, service_role;
grant execute on function public.promote_opportunity_to_project(uuid) to authenticated, service_role;
grant execute on function public.get_official_covering_summary_for_point(double precision, double precision) to authenticated, service_role;
