-- Atomic project + primary-site create/update.
-- Organization is resolved from auth.uid() membership, never from the client.
-- SECURITY DEFINER with an empty search_path; PostGIS calls are schema-qualified.

create or replace function public.slugify_project_name(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_slug text;
begin
  v_slug := pg_catalog.lower(pg_catalog.btrim(coalesce(p_name, '')));
  v_slug := pg_catalog.translate(
    v_slug,
    'àáâãäåāăąèéêëēĕėęěìíîïĩīįòóôõöøōŏőùúûüũūŭůýÿćĉčçďđĝğġģĥħĵķĺļľłńņňŋŕŗřśŝşšţťŧŵŷźżž',
    'aaaaaaaaaeeeeeeeeeiiiiiiiiooooooooooouuuuuuuuyycccccddgggghhjkkllllnnnnrrrsssstttwyzzz'
  );
  v_slug := pg_catalog.regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
  v_slug := pg_catalog.btrim(v_slug, '-');
  if v_slug is null or pg_catalog.char_length(v_slug) = 0 then
    return 'project';
  end if;
  return pg_catalog.left(v_slug, 80);
end;
$$;

create or replace function public.allocate_project_slug(
  p_organization_id uuid,
  p_name text,
  p_exclude_project_id uuid default null
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
  v_slug := v_base;

  loop
    exit when not exists (
      select 1
      from public.projects as p
      where p.organization_id = p_organization_id
        and p.slug = v_slug
        and (p_exclude_project_id is null or p.id <> p_exclude_project_id)
    );
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n::text;
  end loop;

  return v_slug;
end;
$$;

create or replace function public.create_project_with_primary_site(
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
  p_target_cod text default null
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
  v_project_id uuid;
  v_geom extensions.geometry;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select m.organization_id, m.role
    into v_org_id, v_role
  from public.organization_members as m
  where m.profile_id = v_user_id
  order by m.created_at
  limit 1;

  if v_org_id is null then
    raise exception 'No organization membership' using errcode = '42501';
  end if;

  if v_role not in ('owner', 'admin', 'member') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

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
    technology,
    import_mw,
    export_mw,
    connection_stage,
    connection_outlook,
    confidence,
    target_cod
  ) values (
    v_org_id,
    p_grid_operator_id,
    v_user_id,
    v_name,
    v_slug,
    v_location,
    v_technology,
    p_import_mw,
    p_export_mw,
    v_stage,
    v_outlook,
    v_confidence,
    v_target
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
  p_target_cod text default null
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

  select m.organization_id, m.role
    into v_org_id, v_role
  from public.organization_members as m
  where m.profile_id = v_user_id
  order by m.created_at
  limit 1;

  if v_org_id is null or v_role not in ('owner', 'admin', 'member') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select p.organization_id, p.slug
    into v_project_org, v_slug
  from public.projects as p
  where p.id = p_project_id;

  if v_project_org is null or v_project_org <> v_org_id then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

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
    technology = v_technology,
    import_mw = p_import_mw,
    export_mw = p_export_mw,
    grid_operator_id = p_grid_operator_id,
    connection_stage = v_stage,
    connection_outlook = v_outlook,
    confidence = v_confidence,
    target_cod = v_target
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

revoke all on function public.slugify_project_name(text) from public, anon, authenticated;
revoke all on function public.allocate_project_slug(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.create_project_with_primary_site(
  text, text, text, double precision, double precision, numeric, numeric, uuid, text, text, text, text
) from public, anon;
revoke all on function public.update_project_with_primary_site(
  uuid, text, text, text, double precision, double precision, numeric, numeric, uuid, text, text, text, text
) from public, anon;

grant execute on function public.create_project_with_primary_site(
  text, text, text, double precision, double precision, numeric, numeric, uuid, text, text, text, text
) to authenticated;
grant execute on function public.update_project_with_primary_site(
  uuid, text, text, text, double precision, double precision, numeric, numeric, uuid, text, text, text, text
) to authenticated;
