-- Explicit workspace onboarding. Membership is not created by an organizations INSERT trigger,
-- so seed/admin SQL can insert organizations without auth.uid().
-- Authenticated clients must call public.create_workspace(); there is no INSERT policy on
-- organizations for the authenticated role.

alter table public.profiles
  add column if not exists job_title text;

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
  v_slug text;
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

  v_slug := pg_catalog.lower(pg_catalog.btrim(company_slug));
  v_slug := pg_catalog.regexp_replace(v_slug, '\s+', '-', 'g');
  v_slug := pg_catalog.regexp_replace(v_slug, '[^a-z0-9-]', '', 'g');
  v_slug := pg_catalog.regexp_replace(v_slug, '-{2,}', '-', 'g');
  v_slug := pg_catalog.btrim(v_slug, '-');

  if v_slug is null
    or pg_catalog.char_length(v_slug) < 2
    or pg_catalog.char_length(v_slug) > 80
  then
    raise exception 'Invalid company slug'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.organizations as o
    where o.slug = v_slug
  ) then
    raise exception 'Organization slug already exists'
      using errcode = '23505';
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

  insert into public.organizations (name, slug)
  values (v_name, v_slug)
  returning id into v_org_id;

  -- Caller is always the owner. Role and profile_id are not client-supplied.
  insert into public.organization_members (organization_id, profile_id, role)
  values (v_org_id, v_user_id, 'owner');

  return v_org_id;
exception
  when unique_violation then
    raise exception 'Organization slug already exists'
      using errcode = '23505';
end;
$$;

revoke all on function public.create_workspace(text, text, text, text) from public;
revoke all on function public.create_workspace(text, text, text, text) from anon;
grant execute on function public.create_workspace(text, text, text, text) to authenticated;
