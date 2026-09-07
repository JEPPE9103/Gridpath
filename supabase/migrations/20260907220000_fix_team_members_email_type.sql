-- list_organization_team_members RETURN QUERY must match declared column types
-- exactly. auth.users.email is varchar(255); the function returns email text.
-- Live failure (SQLSTATE 42804):
-- Returned type character varying(255) does not match expected type text in column 5.

create or replace function public.list_organization_team_members(p_organization_id uuid)
returns table (
  membership_id uuid,
  profile_id uuid,
  full_name text,
  job_title text,
  email text,
  role text,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not private.belongs_to_organization(p_organization_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select
    m.id,
    m.profile_id,
    p.full_name,
    p.job_title,
    u.email::text,
    m.role,
    m.created_at
  from public.organization_members as m
  inner join public.profiles as p on p.id = m.profile_id
  inner join auth.users as u on u.id = m.profile_id
  where m.organization_id = p_organization_id
  order by m.created_at asc, p.full_name asc nulls last;
end;
$$;

revoke all on function public.list_organization_team_members(uuid) from public, anon;
grant execute on function public.list_organization_team_members(uuid) to authenticated;

comment on function public.list_organization_team_members(uuid) is
  'Members of one organization the caller belongs to. Email is cast to text to match RETURN QUERY.';
