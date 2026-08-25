-- Store job title from signup metadata, and uniquify organization slugs in create_workspace.
-- Signature of public.create_workspace(text, text, text, text) is unchanged.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, job_title)
  values (
    new.id,
    nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(pg_catalog.btrim(coalesce(new.raw_user_meta_data ->> 'job_title', '')), '')
  );
  return new;
end;
$$;

create or replace function public.allocate_organization_slug(p_name text)
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
    v_base := 'workspace';
  end if;
  v_slug := v_base;

  loop
    exit when not exists (
      select 1
      from public.organizations as o
      where o.slug = v_slug
    );
    v_n := v_n + 1;
    if v_n > 1000 then
      raise exception 'Could not allocate an organization slug'
        using errcode = '23505';
    end if;
    -- First taken slug stays as the base; collisions become name-2, name-3, ...
    v_slug := v_base || '-' || v_n::text;
  end loop;

  return v_slug;
end;
$$;

revoke all on function public.allocate_organization_slug(text) from public, anon, authenticated;

create or replace function public.create_workspace(
  company_name text,
  company_slug text,
  user_full_name text default null,
  user_job_title text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_name text;
  v_slug_source text;
  v_attempt integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated'
      using errcode = '28000';
  end if;

  v_name := pg_catalog.btrim(company_name);
  if v_name is null or pg_catalog.char_length(v_name) = 0 then
    raise exception 'Company name is required'
      using errcode = '22023';
  end if;

  v_slug_source := nullif(pg_catalog.btrim(coalesce(company_slug, '')), '');
  if v_slug_source is null then
    v_slug_source := v_name;
  end if;

  insert into public.profiles (id, full_name, job_title)
  values (
    v_user_id,
    nullif(pg_catalog.btrim(coalesce(user_full_name, '')), ''),
    nullif(pg_catalog.btrim(coalesce(user_job_title, '')), '')
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    job_title = coalesce(excluded.job_title, public.profiles.job_title);

  -- Caller cannot choose organization_id or role. Retry rare concurrent slug races.
  for v_attempt in 1..8 loop
    begin
      insert into public.organizations (name, slug)
      values (v_name, public.allocate_organization_slug(v_slug_source))
      returning id into v_org_id;
      exit;
    exception
      when unique_violation then
        if v_attempt = 8 then
          raise exception 'Could not allocate an organization slug'
            using errcode = '23505';
        end if;
    end;
  end loop;

  insert into public.organization_members (organization_id, profile_id, role)
  values (v_org_id, v_user_id, 'owner');

  return v_org_id;
end;
$$;

revoke all on function public.create_workspace(text, text, text, text) from public, anon;
grant execute on function public.create_workspace(text, text, text, text) to authenticated;
