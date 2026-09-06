-- Phase 2+3: project archive, scale-safe aggregates, portfolio import, optional project fields on RPCs.
-- Do not apply to the linked cloud database from this change set.

-- ---------------------------------------------------------------------------
-- Archive columns + indexes
-- ---------------------------------------------------------------------------

alter table public.projects
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles (id) on delete set null;

comment on column public.projects.archived_at is
  'When set, the project is archived and excluded from the active portfolio by default. Associated rows are retained.';
comment on column public.projects.archived_by is
  'Profile that archived the project. Null if restored or never archived.';

create index if not exists projects_organization_id_updated_at_idx
  on public.projects (organization_id, updated_at desc);

create index if not exists projects_organization_id_active_updated_idx
  on public.projects (organization_id, updated_at desc)
  where archived_at is null;

create index if not exists projects_organization_id_archived_updated_idx
  on public.projects (organization_id, updated_at desc)
  where archived_at is not null;

create index if not exists projects_organization_id_lower_name_idx
  on public.projects (organization_id, lower(name));

-- ---------------------------------------------------------------------------
-- Import history
-- ---------------------------------------------------------------------------

create table public.portfolio_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  filename text,
  success_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  added_mw numeric not null default 0,
  official_match_count integer,
  constraint portfolio_imports_counts_non_negative check (
    success_count >= 0 and skipped_count >= 0 and failed_count >= 0
  )
);

create index portfolio_imports_organization_id_created_at_idx
  on public.portfolio_imports (organization_id, created_at desc);

alter table public.portfolio_imports enable row level security;
alter table public.portfolio_imports force row level security;

create policy portfolio_imports_select_authenticated
  on public.portfolio_imports
  for select
  to authenticated
  using (private.belongs_to_organization(organization_id));

revoke all on table public.portfolio_imports from public, anon;
grant select on table public.portfolio_imports to authenticated;

comment on table public.portfolio_imports is
  'Traceability for bulk portfolio imports. Rows are created by import_organization_projects, not by client inserts.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function private.portfolio_capacity_mw(p_import_mw numeric, p_export_mw numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_export_mw, 0) > 0 then p_export_mw
    else coalesce(p_import_mw, 0)
  end;
$$;

comment on function private.portfolio_capacity_mw(numeric, numeric) is
  'Same rule as application portfolioCapacityMW: export MW when > 0, otherwise import MW.';

create or replace function private.project_has_official_grid_context(p_geom extensions.geometry)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_geom is not null
    and (
      exists (select 1 from private.ei_local_network_areas_covering_geom(p_geom))
      or exists (select 1 from private.ei_nup_planning_areas_covering_geom(p_geom))
    );
$$;

revoke all on function private.portfolio_capacity_mw(numeric, numeric) from public, anon, authenticated;
revoke all on function private.project_has_official_grid_context(extensions.geometry) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Aggregates (complete, not max_rows truncated)
-- ---------------------------------------------------------------------------

create or replace function public.get_organization_project_aggregates(
  p_organization_id uuid,
  p_include_archived boolean default false
)
returns table (
  active_count integer,
  archived_count integer,
  all_count integer,
  active_mw numeric,
  enquiry_count integer,
  open_grid_study_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_active_count integer;
  v_archived_count integer;
  v_active_mw numeric;
  v_enquiry integer;
  v_studies integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_organization_id is null or not private.belongs_to_organization(p_organization_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select
    count(*) filter (where p.archived_at is null)::integer,
    count(*) filter (where p.archived_at is not null)::integer,
    coalesce(sum(private.portfolio_capacity_mw(p.import_mw, p.export_mw)) filter (where p.archived_at is null), 0)
  into v_active_count, v_archived_count, v_active_mw
  from public.projects as p
  where p.organization_id = p_organization_id;

  select count(*)::integer
    into v_enquiry
  from public.connection_cases as c
  inner join public.projects as cp on cp.id = c.project_id
  where cp.organization_id = p_organization_id
    and (p_include_archived or cp.archived_at is null)
    and c.stage = 'enquiry';

  select count(*)::integer
    into v_studies
  from public.connection_cases as c
  inner join public.projects as cp on cp.id = c.project_id
  where cp.organization_id = p_organization_id
    and (p_include_archived or cp.archived_at is null)
    and c.stage = 'grid_study'
    and c.status not in ('complete', 'cancelled');

  active_count := v_active_count;
  archived_count := v_archived_count;
  all_count := v_active_count + v_archived_count;
  active_mw := v_active_mw;
  enquiry_count := v_enquiry;
  open_grid_study_count := v_studies;
  return next;
end;
$$;

comment on function public.get_organization_project_aggregates(uuid, boolean) is
  'Tenant-scoped portfolio totals. Counts and MW are computed in SQL so PostgREST max_rows cannot truncate them. Default connection KPIs exclude archived projects.';

revoke all on function public.get_organization_project_aggregates(uuid, boolean) from public, anon;
grant execute on function public.get_organization_project_aggregates(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Archive / restore
-- ---------------------------------------------------------------------------

create or replace function public.archive_project(p_project_id uuid)
returns table (project_id uuid, slug text, archived_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_role text;
  v_slug text;
  v_archived_at timestamptz;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_project_id is null then
    raise exception 'Project is required' using errcode = '22023';
  end if;

  select p.organization_id, p.slug, p.archived_at
    into v_org_id, v_slug, v_archived_at
  from public.projects as p
  where p.id = p_project_id;

  if v_org_id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select m.role
    into v_role
  from public.organization_members as m
  where m.profile_id = v_user_id
    and m.organization_id = v_org_id;

  if v_role is null or v_role not in ('owner', 'admin', 'member') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_archived_at is not null then
    project_id := p_project_id;
    slug := v_slug;
    archived_at := v_archived_at;
    return next;
    return;
  end if;

  update public.projects
  set archived_at = now(), archived_by = v_user_id
  where id = p_project_id
    and organization_id = v_org_id
  returning public.projects.archived_at into v_archived_at;

  insert into public.project_events (project_id, title, detail, source)
  values (
    p_project_id,
    'Project archived',
    'Project was archived and removed from the active portfolio. Associated records were kept.',
    'Customer Data'
  );

  project_id := p_project_id;
  slug := v_slug;
  archived_at := v_archived_at;
  return next;
end;
$$;

create or replace function public.restore_project(p_project_id uuid)
returns table (project_id uuid, slug text, archived_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_role text;
  v_slug text;
  v_archived_at timestamptz;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_project_id is null then
    raise exception 'Project is required' using errcode = '22023';
  end if;

  select p.organization_id, p.slug, p.archived_at
    into v_org_id, v_slug, v_archived_at
  from public.projects as p
  where p.id = p_project_id;

  if v_org_id is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select m.role
    into v_role
  from public.organization_members as m
  where m.profile_id = v_user_id
    and m.organization_id = v_org_id;

  if v_role is null or v_role not in ('owner', 'admin', 'member') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_archived_at is null then
    project_id := p_project_id;
    slug := v_slug;
    archived_at := null;
    return next;
    return;
  end if;

  update public.projects
  set archived_at = null, archived_by = null
  where id = p_project_id
    and organization_id = v_org_id;

  insert into public.project_events (project_id, title, detail, source)
  values (
    p_project_id,
    'Project restored',
    'Project was restored to the active portfolio.',
    'Customer Data'
  );

  project_id := p_project_id;
  slug := v_slug;
  archived_at := null;
  return next;
end;
$$;

revoke all on function public.archive_project(uuid) from public, anon;
revoke all on function public.restore_project(uuid) from public, anon;
grant execute on function public.archive_project(uuid) to authenticated;
grant execute on function public.restore_project(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Extend create/update RPCs with description, region, voltage_level
-- ---------------------------------------------------------------------------

drop function if exists public.create_project_with_primary_site(
  uuid, text, text, text, double precision, double precision, numeric, numeric, uuid, text, text, text, text
);

create or replace function public.create_project_with_primary_site(
  p_organization_id uuid,
  p_name text,
  p_technology text,
  p_location text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_import_mw numeric default null,
  p_export_mw numeric default null,
  p_grid_operator_id uuid default null,
  p_connection_stage text default 'prospect',
  p_connection_outlook text default 'unknown',
  p_confidence text default 'unknown',
  p_target_cod text default null,
  p_description text default null,
  p_region text default null,
  p_voltage_level text default null
)
returns table (project_id uuid, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_role text;
  v_name text;
  v_slug text;
  v_location text;
  v_stage text;
  v_outlook text;
  v_confidence text;
  v_target text;
  v_technology text;
  v_description text;
  v_region text;
  v_voltage text;
  v_project_id uuid;
  v_geom extensions.geometry;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_organization_id is null then
    raise exception 'Organization is required' using errcode = '22023';
  end if;

  select m.role
    into v_role
  from public.organization_members as m
  where m.profile_id = v_user_id
    and m.organization_id = p_organization_id;

  if v_role is null or v_role not in ('owner', 'admin', 'member') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  v_org_id := p_organization_id;

  v_name := pg_catalog.btrim(coalesce(p_name, ''));
  if pg_catalog.char_length(v_name) = 0 then
    raise exception 'Project name is required' using errcode = '22023';
  end if;

  v_technology := nullif(pg_catalog.btrim(coalesce(p_technology, '')), '');
  if v_technology is null or v_technology not in (
    'battery_storage', 'solar', 'wind', 'ev_infrastructure', 'industrial', 'other'
  ) then
    raise exception 'Invalid technology' using errcode = '22023';
  end if;

  if p_latitude is null or p_longitude is null
    or p_latitude < -90 or p_latitude > 90
    or p_longitude < -180 or p_longitude > 180
  then
    raise exception 'Invalid coordinates' using errcode = '22023';
  end if;

  if (p_import_mw is not null and p_import_mw < 0)
    or (p_export_mw is not null and p_export_mw < 0)
  then
    raise exception 'Capacity cannot be negative' using errcode = '22023';
  end if;

  v_stage := coalesce(nullif(pg_catalog.btrim(p_connection_stage), ''), 'prospect');
  v_outlook := coalesce(nullif(pg_catalog.btrim(p_connection_outlook), ''), 'unknown');
  v_confidence := coalesce(nullif(pg_catalog.btrim(p_confidence), ''), 'unknown');
  v_location := nullif(pg_catalog.btrim(coalesce(p_location, '')), '');
  v_target := nullif(pg_catalog.btrim(coalesce(p_target_cod, '')), '');
  v_description := nullif(pg_catalog.btrim(coalesce(p_description, '')), '');
  v_region := nullif(pg_catalog.btrim(coalesce(p_region, '')), '');
  v_voltage := nullif(pg_catalog.btrim(coalesce(p_voltage_level, '')), '');

  if v_stage not in (
    'prospect', 'screened', 'enquiry', 'application', 'grid_study', 'offer', 'agreement', 'construction', 'energisation'
  ) then
    raise exception 'Invalid connection stage' using errcode = '22023';
  end if;

  if v_outlook not in ('favourable', 'possible', 'at_risk', 'weak', 'unknown') then
    raise exception 'Invalid outlook' using errcode = '22023';
  end if;

  if v_confidence not in ('high', 'medium', 'low', 'unknown') then
    raise exception 'Invalid confidence' using errcode = '22023';
  end if;

  if p_grid_operator_id is not null and not exists (
    select 1 from public.grid_operators as g where g.id = p_grid_operator_id
  ) then
    raise exception 'Grid operator not found' using errcode = '22023';
  end if;

  v_slug := public.allocate_project_slug(v_org_id, v_name, null);
  v_geom := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326);

  insert into public.projects (
    organization_id,
    grid_operator_id,
    owner_id,
    name,
    slug,
    location,
    region,
    technology,
    import_mw,
    export_mw,
    voltage_level,
    connection_stage,
    connection_outlook,
    confidence,
    target_cod,
    description
  ) values (
    v_org_id,
    p_grid_operator_id,
    v_user_id,
    v_name,
    v_slug,
    v_location,
    v_region,
    v_technology,
    p_import_mw,
    p_export_mw,
    v_voltage,
    v_stage,
    v_outlook,
    v_confidence,
    v_target,
    v_description
  )
  returning id into v_project_id;

  insert into public.project_sites (
    project_id,
    name,
    location,
    geom,
    is_primary
  ) values (
    v_project_id,
    v_name,
    v_location,
    v_geom,
    true
  );

  insert into public.project_events (
    project_id,
    title,
    detail,
    source
  ) values (
    v_project_id,
    'Project created',
    'Project record and primary site were created.',
    'Customer Data'
  );

  project_id := v_project_id;
  slug := v_slug;
  return next;
end;
$$;

drop function if exists public.update_project_with_primary_site(
  uuid, text, text, text, double precision, double precision, numeric, numeric, uuid, text, text, text, text
);

create or replace function public.update_project_with_primary_site(
  p_project_id uuid,
  p_name text,
  p_technology text,
  p_location text default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_import_mw numeric default null,
  p_export_mw numeric default null,
  p_grid_operator_id uuid default null,
  p_connection_stage text default 'prospect',
  p_connection_outlook text default 'unknown',
  p_confidence text default 'unknown',
  p_target_cod text default null,
  p_description text default null,
  p_region text default null,
  p_voltage_level text default null
)
returns table (project_id uuid, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_role text;
  v_project_org uuid;
  v_slug text;
  v_name text;
  v_location text;
  v_stage text;
  v_outlook text;
  v_confidence text;
  v_target text;
  v_technology text;
  v_description text;
  v_region text;
  v_voltage text;
  v_geom extensions.geometry;
  v_site_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_project_id is null then
    raise exception 'Project is required' using errcode = '22023';
  end if;

  select p.organization_id, p.slug
    into v_project_org, v_slug
  from public.projects as p
  where p.id = p_project_id;

  if v_project_org is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select m.role
    into v_role
  from public.organization_members as m
  where m.profile_id = v_user_id
    and m.organization_id = v_project_org;

  if v_role is null or v_role not in ('owner', 'admin', 'member') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  v_org_id := v_project_org;

  v_name := pg_catalog.btrim(coalesce(p_name, ''));
  if pg_catalog.char_length(v_name) = 0 then
    raise exception 'Project name is required' using errcode = '22023';
  end if;

  v_technology := nullif(pg_catalog.btrim(coalesce(p_technology, '')), '');
  if v_technology is null or v_technology not in (
    'battery_storage', 'solar', 'wind', 'ev_infrastructure', 'industrial', 'other'
  ) then
    raise exception 'Invalid technology' using errcode = '22023';
  end if;

  if p_latitude is null or p_longitude is null
    or p_latitude < -90 or p_latitude > 90
    or p_longitude < -180 or p_longitude > 180
  then
    raise exception 'Invalid coordinates' using errcode = '22023';
  end if;

  if (p_import_mw is not null and p_import_mw < 0)
    or (p_export_mw is not null and p_export_mw < 0)
  then
    raise exception 'Capacity cannot be negative' using errcode = '22023';
  end if;

  v_stage := coalesce(nullif(pg_catalog.btrim(p_connection_stage), ''), 'prospect');
  v_outlook := coalesce(nullif(pg_catalog.btrim(p_connection_outlook), ''), 'unknown');
  v_confidence := coalesce(nullif(pg_catalog.btrim(p_confidence), ''), 'unknown');
  v_location := nullif(pg_catalog.btrim(coalesce(p_location, '')), '');
  v_target := nullif(pg_catalog.btrim(coalesce(p_target_cod, '')), '');
  v_description := nullif(pg_catalog.btrim(coalesce(p_description, '')), '');
  v_region := nullif(pg_catalog.btrim(coalesce(p_region, '')), '');
  v_voltage := nullif(pg_catalog.btrim(coalesce(p_voltage_level, '')), '');

  if v_stage not in (
    'prospect', 'screened', 'enquiry', 'application', 'grid_study', 'offer', 'agreement', 'construction', 'energisation'
  ) then
    raise exception 'Invalid connection stage' using errcode = '22023';
  end if;

  if v_outlook not in ('favourable', 'possible', 'at_risk', 'weak', 'unknown') then
    raise exception 'Invalid outlook' using errcode = '22023';
  end if;

  if v_confidence not in ('high', 'medium', 'low', 'unknown') then
    raise exception 'Invalid confidence' using errcode = '22023';
  end if;

  if p_grid_operator_id is not null and not exists (
    select 1 from public.grid_operators as g where g.id = p_grid_operator_id
  ) then
    raise exception 'Grid operator not found' using errcode = '22023';
  end if;

  v_geom := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326);

  update public.projects
  set
    name = v_name,
    location = v_location,
    region = v_region,
    technology = v_technology,
    import_mw = p_import_mw,
    export_mw = p_export_mw,
    voltage_level = v_voltage,
    grid_operator_id = p_grid_operator_id,
    connection_stage = v_stage,
    connection_outlook = v_outlook,
    confidence = v_confidence,
    target_cod = v_target,
    description = v_description
  where id = p_project_id
    and organization_id = v_org_id;

  select s.id
    into v_site_id
  from public.project_sites as s
  where s.project_id = p_project_id
    and s.is_primary
  limit 1;

  if v_site_id is null then
    insert into public.project_sites (project_id, name, location, geom, is_primary)
    values (p_project_id, v_name, v_location, v_geom, true);
  else
    update public.project_sites
    set
      name = v_name,
      location = v_location,
      geom = v_geom
    where id = v_site_id
      and public.project_sites.project_id = p_project_id
      and public.project_sites.is_primary;
  end if;

  insert into public.project_events (project_id, title, detail, source)
  values (
    p_project_id,
    'Project details updated',
    'Project details or primary site coordinates were updated.',
    'Customer Data'
  );

  project_id := p_project_id;
  slug := v_slug;
  return next;
end;
$$;

revoke all on function public.create_project_with_primary_site(
  uuid, text, text, text, double precision, double precision, numeric, numeric, uuid, text, text, text, text, text, text, text
) from public, anon;
revoke all on function public.update_project_with_primary_site(
  uuid, text, text, text, double precision, double precision, numeric, numeric, uuid, text, text, text, text, text, text, text
) from public, anon;

grant execute on function public.create_project_with_primary_site(
  uuid, text, text, text, double precision, double precision, numeric, numeric, uuid, text, text, text, text, text, text, text
) to authenticated;
grant execute on function public.update_project_with_primary_site(
  uuid, text, text, text, double precision, double precision, numeric, numeric, uuid, text, text, text, text, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Bulk import
-- ---------------------------------------------------------------------------

create or replace function public.import_organization_projects(
  p_organization_id uuid,
  p_filename text,
  p_rows jsonb,
  p_skipped_count integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_role text;
  v_import_id uuid;
  v_item jsonb;
  v_index integer := 0;
  v_success integer := 0;
  v_failed integer := 0;
  v_added_mw numeric := 0;
  v_official integer := 0;
  v_failures jsonb := '[]'::jsonb;
  v_created_ids uuid[] := '{}';
  v_name text;
  v_technology text;
  v_location text;
  v_lat double precision;
  v_lng double precision;
  v_import_mw numeric;
  v_export_mw numeric;
  v_operator uuid;
  v_stage text;
  v_outlook text;
  v_confidence text;
  v_target text;
  v_description text;
  v_region text;
  v_voltage text;
  v_slug text;
  v_geom extensions.geometry;
  v_project_id uuid;
  v_err text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_organization_id is null then
    raise exception 'Organization is required' using errcode = '22023';
  end if;

  select m.role
    into v_role
  from public.organization_members as m
  where m.profile_id = v_user_id
    and m.organization_id = p_organization_id;

  if v_role is null or v_role not in ('owner', 'admin', 'member') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Import rows are required' using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'Import is limited to 2000 rows' using errcode = '22023';
  end if;

  insert into public.portfolio_imports (
    organization_id,
    created_by,
    filename
  ) values (
    p_organization_id,
    v_user_id,
    nullif(pg_catalog.btrim(coalesce(p_filename, '')), '')
  )
  returning id into v_import_id;

  for v_item in
    select value from jsonb_array_elements(p_rows)
  loop
    v_index := v_index + 1;
    begin
      v_name := pg_catalog.btrim(coalesce(v_item->>'name', ''));
      if pg_catalog.char_length(v_name) = 0 then
        raise exception 'Project name is required';
      end if;

      v_technology := nullif(pg_catalog.btrim(coalesce(v_item->>'technology', '')), '');
      if v_technology is null or v_technology not in (
        'battery_storage', 'solar', 'wind', 'ev_infrastructure', 'industrial', 'other'
      ) then
        raise exception 'Invalid technology';
      end if;

      v_lat := (v_item->>'latitude')::double precision;
      v_lng := (v_item->>'longitude')::double precision;
      if v_lat is null or v_lng is null
        or v_lat < -90 or v_lat > 90
        or v_lng < -180 or v_lng > 180
      then
        raise exception 'Invalid coordinates';
      end if;

      v_import_mw := nullif(v_item->>'import_mw', '')::numeric;
      v_export_mw := nullif(v_item->>'export_mw', '')::numeric;
      if (v_import_mw is not null and v_import_mw < 0)
        or (v_export_mw is not null and v_export_mw < 0)
      then
        raise exception 'Capacity cannot be negative';
      end if;

      v_stage := coalesce(nullif(pg_catalog.btrim(coalesce(v_item->>'connection_stage', '')), ''), 'prospect');
      v_outlook := coalesce(nullif(pg_catalog.btrim(coalesce(v_item->>'connection_outlook', '')), ''), 'unknown');
      v_confidence := coalesce(nullif(pg_catalog.btrim(coalesce(v_item->>'confidence', '')), ''), 'unknown');
      v_location := nullif(pg_catalog.btrim(coalesce(v_item->>'location', '')), '');
      v_target := nullif(pg_catalog.btrim(coalesce(v_item->>'target_cod', '')), '');
      v_description := nullif(pg_catalog.btrim(coalesce(v_item->>'description', '')), '');
      v_region := nullif(pg_catalog.btrim(coalesce(v_item->>'region', '')), '');
      v_voltage := nullif(pg_catalog.btrim(coalesce(v_item->>'voltage_level', '')), '');
      v_operator := nullif(v_item->>'grid_operator_id', '')::uuid;

      if v_stage not in (
        'prospect', 'screened', 'enquiry', 'application', 'grid_study', 'offer', 'agreement', 'construction', 'energisation'
      ) then
        raise exception 'Invalid connection stage';
      end if;

      if v_outlook not in ('favourable', 'possible', 'at_risk', 'weak', 'unknown') then
        raise exception 'Invalid outlook';
      end if;

      if v_confidence not in ('high', 'medium', 'low', 'unknown') then
        raise exception 'Invalid confidence';
      end if;

      if v_operator is not null and not exists (
        select 1 from public.grid_operators as g where g.id = v_operator
      ) then
        raise exception 'Grid operator not found';
      end if;

      v_slug := public.allocate_project_slug(p_organization_id, v_name, null);
      v_geom := extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326);

      insert into public.projects (
        organization_id,
        grid_operator_id,
        owner_id,
        name,
        slug,
        location,
        region,
        technology,
        import_mw,
        export_mw,
        voltage_level,
        connection_stage,
        connection_outlook,
        confidence,
        target_cod,
        description
      ) values (
        p_organization_id,
        v_operator,
        v_user_id,
        v_name,
        v_slug,
        v_location,
        v_region,
        v_technology,
        v_import_mw,
        v_export_mw,
        v_voltage,
        v_stage,
        v_outlook,
        v_confidence,
        v_target,
        v_description
      )
      returning id into v_project_id;

      insert into public.project_sites (project_id, name, location, geom, is_primary)
      values (v_project_id, v_name, v_location, v_geom, true);

      insert into public.project_events (project_id, title, detail, source)
      values (
        v_project_id,
        'Project imported',
        'Imported in batch ' || v_import_id::text || '.',
        'Customer Data'
      );

      v_created_ids := array_append(v_created_ids, v_project_id);
      v_success := v_success + 1;
      v_added_mw := v_added_mw + private.portfolio_capacity_mw(v_import_mw, v_export_mw);
      if private.project_has_official_grid_context(v_geom) then
        v_official := v_official + 1;
      end if;
    exception
      when others then
        v_err := pg_catalog.left(sqlerrm, 200);
        v_failed := v_failed + 1;
        v_failures := v_failures || jsonb_build_array(
          jsonb_build_object('index', v_index - 1, 'name', v_item->>'name', 'error', v_err)
        );
    end;
  end loop;

  update public.portfolio_imports
  set
    success_count = v_success,
    skipped_count = greatest(coalesce(p_skipped_count, 0), 0),
    failed_count = v_failed,
    added_mw = v_added_mw,
    official_match_count = v_official
  where id = v_import_id
    and organization_id = p_organization_id;

  return jsonb_build_object(
    'import_id', v_import_id,
    'success_count', v_success,
    'failed_count', v_failed,
    'added_mw', v_added_mw,
    'official_match_count', v_official,
    'created_project_ids', to_jsonb(v_created_ids),
    'failures', v_failures
  );
end;
$$;

comment on function public.import_organization_projects(uuid, text, jsonb, integer) is
  'Creates standard projects + primary PostGIS sites for the authenticated member''s organisation. Organization is taken from membership, not trusted from the client alone.';

revoke all on function public.import_organization_projects(uuid, text, jsonb, integer) from public, anon;
grant execute on function public.import_organization_projects(uuid, text, jsonb, integer) to authenticated;
