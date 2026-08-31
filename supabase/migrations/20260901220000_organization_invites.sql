-- Organization invitations and team management RPCs.
-- Additive migration: safe to apply before Phase 2B app deploy.

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role text not null,
  token_hash text not null,
  invited_by uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  constraint organization_invites_role_check
    check (role in ('owner', 'admin', 'member', 'viewer')),
  constraint organization_invites_status_check
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  constraint organization_invites_token_hash_unique unique (token_hash)
);

create index organization_invites_organization_id_idx
  on public.organization_invites (organization_id);

create index organization_invites_email_lower_idx
  on public.organization_invites (organization_id, lower(email));

create unique index organization_invites_one_pending_per_email
  on public.organization_invites (organization_id, lower(email))
  where status = 'pending';

alter table public.organization_invites enable row level security;
alter table public.organization_invites force row level security;

create policy organization_invites_select_admin
  on public.organization_invites
  for select
  to authenticated
  using (private.is_organization_admin(organization_id));

revoke all on table public.organization_invites from public, anon;
grant select on table public.organization_invites to authenticated;

create or replace function private.normalize_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(pg_catalog.btrim(coalesce(p_email, '')));
$$;

create or replace function private.organization_owner_count(p_organization_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.organization_members as m
  where m.organization_id = p_organization_id
    and m.role = 'owner';
$$;

create or replace function private.can_grant_invite_role(p_actor_role text, p_invite_role text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_actor_role = 'owner' then p_invite_role in ('owner', 'admin', 'member', 'viewer')
    when p_actor_role = 'admin' then p_invite_role in ('member', 'viewer')
    else false
  end;
$$;

create or replace function private.can_manage_target_member(
  p_actor_role text,
  p_target_role text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_actor_role = 'owner' then true
    when p_actor_role = 'admin' then p_target_role in ('member', 'viewer')
    else false
  end;
$$;

create or replace function private.can_assign_member_role(
  p_actor_role text,
  p_target_role text,
  p_new_role text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_actor_role = 'owner' then p_new_role in ('owner', 'admin', 'member', 'viewer')
    when p_actor_role = 'admin'
      then p_target_role in ('member', 'viewer')
       and p_new_role in ('member', 'viewer')
    else false
  end;
$$;

create or replace function private.auth_user_email_confirmed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select u.email_confirmed_at is not null
      from auth.users as u
      where u.id = p_user_id
    ),
    false
  );
$$;

create or replace function private.auth_user_normalized_email(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.normalize_email(u.email)
  from auth.users as u
  where u.id = p_user_id;
$$;

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
    u.email,
    m.role,
    m.created_at
  from public.organization_members as m
  inner join public.profiles as p on p.id = m.profile_id
  inner join auth.users as u on u.id = m.profile_id
  where m.organization_id = p_organization_id
  order by m.created_at asc, p.full_name asc nulls last;
end;
$$;

create or replace function public.list_organization_pending_invites(p_organization_id uuid)
returns table (
  invite_id uuid,
  email text,
  role text,
  invited_by_name text,
  expires_at timestamptz,
  created_at timestamptz,
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  v_actor_role := private.organization_role(p_organization_id);
  if v_actor_role is null or v_actor_role not in ('owner', 'admin') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select
    i.id,
    i.email,
    i.role,
    coalesce(p.full_name, 'Team member'),
    i.expires_at,
    i.created_at,
    case
      when i.status = 'pending' and i.expires_at <= now() then 'expired'
      else i.status
    end
  from public.organization_invites as i
  left join public.profiles as p on p.id = i.invited_by
  where i.organization_id = p_organization_id
    and i.status in ('pending', 'accepted', 'revoked', 'expired')
  order by i.created_at desc;
end;
$$;

create or replace function public.get_organization_invite_preview(p_token_hash text)
returns table (
  organization_name text,
  invite_role text,
  invite_email text,
  expires_at timestamptz,
  status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    o.name,
    i.role,
    i.email,
    i.expires_at,
    case
      when i.status = 'pending' and i.expires_at <= now() then 'expired'
      else i.status
    end
  from public.organization_invites as i
  inner join public.organizations as o on o.id = i.organization_id
  where i.token_hash = p_token_hash
  limit 1;
end;
$$;

create or replace function public.create_organization_invite(
  p_organization_id uuid,
  p_email text,
  p_role text,
  p_token_hash text
)
returns table (invite_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_actor_role text;
  v_email text;
  v_invite_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  v_email := private.normalize_email(p_email);
  if v_email is null or pg_catalog.char_length(v_email) = 0 or position('@' in v_email) = 0 then
    raise exception 'Invalid email' using errcode = '22023';
  end if;

  if p_organization_id is null or p_token_hash is null or pg_catalog.btrim(p_token_hash) = '' then
    raise exception 'Invalid invitation' using errcode = '22023';
  end if;

  if p_role is null or p_role not in ('owner', 'admin', 'member', 'viewer') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;

  v_actor_role := private.organization_role(p_organization_id);
  if v_actor_role is null or not private.can_grant_invite_role(v_actor_role, p_role) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.organization_members as m
    inner join auth.users as u on u.id = m.profile_id
    where m.organization_id = p_organization_id
      and private.normalize_email(u.email) = v_email
  ) then
    raise exception 'Already a member' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.organization_invites as i
    where i.organization_id = p_organization_id
      and lower(i.email) = v_email
      and i.status = 'pending'
      and i.expires_at > now()
  ) then
    raise exception 'Invite already pending' using errcode = '23505';
  end if;

  insert into public.organization_invites (
    organization_id,
    email,
    role,
    token_hash,
    invited_by,
    status,
    expires_at
  ) values (
    p_organization_id,
    v_email,
    p_role,
    p_token_hash,
    v_user_id,
    'pending',
    now() + interval '7 days'
  )
  returning id into v_invite_id;

  invite_id := v_invite_id;
  return next;
end;
$$;

create or replace function public.revoke_organization_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_invite record;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select i.* into v_invite
  from public.organization_invites as i
  where i.id = p_invite_id;

  if v_invite.id is null then
    raise exception 'Invite not found' using errcode = '22023';
  end if;

  v_actor_role := private.organization_role(v_invite.organization_id);
  if v_actor_role is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_actor_role = 'admin' and v_invite.role not in ('member', 'viewer') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_actor_role not in ('owner', 'admin') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'Invite not active' using errcode = '22023';
  end if;

  update public.organization_invites
  set status = 'revoked', revoked_at = now()
  where id = p_invite_id
    and status = 'pending';
end;
$$;

create or replace function public.accept_organization_invite(p_token_hash text)
returns table (organization_id uuid, organization_name text, invite_role text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_user_email text;
  v_invite record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not private.auth_user_email_confirmed(v_user_id) then
    raise exception 'Email confirmation required' using errcode = '42501';
  end if;

  v_user_email := private.auth_user_normalized_email(v_user_id);
  if v_user_email is null or pg_catalog.char_length(v_user_email) = 0 then
    raise exception 'Email required' using errcode = '22023';
  end if;

  select i.* into v_invite
  from public.organization_invites as i
  where i.token_hash = p_token_hash
  for update;

  if v_invite.id is null then
    raise exception 'Invite not found' using errcode = '22023';
  end if;

  if v_invite.status = 'accepted' then
    raise exception 'Invite already accepted' using errcode = '22023';
  end if;

  if v_invite.status = 'revoked' then
    raise exception 'Invite revoked' using errcode = '42501';
  end if;

  if v_invite.status <> 'pending' or v_invite.expires_at <= now() then
    update public.organization_invites
    set status = 'expired'
    where id = v_invite.id
      and status = 'pending';

    raise exception 'Invite expired' using errcode = '22023';
  end if;

  if v_invite.email <> v_user_email then
    raise exception 'Invite email mismatch' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.organization_members as m
    where m.organization_id = v_invite.organization_id
      and m.profile_id = v_user_id
  ) then
    update public.organization_invites
    set status = 'accepted', accepted_at = now()
    where id = v_invite.id
      and status = 'pending';

    return query
    select o.id, o.name, v_invite.role
    from public.organizations as o
    where o.id = v_invite.organization_id;
    return;
  end if;

  insert into public.organization_members (organization_id, profile_id, role)
  values (v_invite.organization_id, v_user_id, v_invite.role);

  update public.organization_invites
  set status = 'accepted', accepted_at = now()
  where id = v_invite.id
    and status = 'pending';

  return query
  select o.id, o.name, v_invite.role
  from public.organizations as o
  where o.id = v_invite.organization_id;
end;
$$;

create or replace function public.change_organization_member_role(
  p_organization_id uuid,
  p_profile_id uuid,
  p_new_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_target_role text;
  v_owner_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_profile_id = auth.uid() then
    raise exception 'Cannot change own role here' using errcode = '42501';
  end if;

  if p_new_role is null or p_new_role not in ('owner', 'admin', 'member', 'viewer') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;

  v_actor_role := private.organization_role(p_organization_id);
  if v_actor_role is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select m.role into v_target_role
  from public.organization_members as m
  where m.organization_id = p_organization_id
    and m.profile_id = p_profile_id;

  if v_target_role is null then
    raise exception 'Member not found' using errcode = '22023';
  end if;

  if not private.can_manage_target_member(v_actor_role, v_target_role) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if not private.can_assign_member_role(v_actor_role, v_target_role, p_new_role) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_target_role = 'owner' and p_new_role <> 'owner' then
    v_owner_count := private.organization_owner_count(p_organization_id);
    if v_owner_count <= 1 then
      raise exception 'Last owner protection' using errcode = '42501';
    end if;
  end if;

  update public.organization_members
  set role = p_new_role
  where organization_id = p_organization_id
    and profile_id = p_profile_id;
end;
$$;

create or replace function public.remove_organization_member(
  p_organization_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_target_role text;
  v_owner_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_profile_id = auth.uid() then
    raise exception 'Cannot remove self here' using errcode = '42501';
  end if;

  v_actor_role := private.organization_role(p_organization_id);
  if v_actor_role is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select m.role into v_target_role
  from public.organization_members as m
  where m.organization_id = p_organization_id
    and m.profile_id = p_profile_id;

  if v_target_role is null then
    raise exception 'Member not found' using errcode = '22023';
  end if;

  if not private.can_manage_target_member(v_actor_role, v_target_role) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_target_role = 'owner' then
    v_owner_count := private.organization_owner_count(p_organization_id);
    if v_owner_count <= 1 then
      raise exception 'Last owner protection' using errcode = '42501';
    end if;
  end if;

  delete from public.organization_members
  where organization_id = p_organization_id
    and profile_id = p_profile_id;
end;
$$;

revoke all on function public.list_organization_team_members(uuid) from public, anon;
revoke all on function public.list_organization_pending_invites(uuid) from public, anon;
revoke all on function public.get_organization_invite_preview(text) from public, anon;
revoke all on function public.create_organization_invite(uuid, text, text, text) from public, anon;
revoke all on function public.revoke_organization_invite(uuid) from public, anon;
revoke all on function public.accept_organization_invite(text) from public, anon;
revoke all on function public.change_organization_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.remove_organization_member(uuid, uuid) from public, anon;

grant execute on function public.list_organization_team_members(uuid) to authenticated;
grant execute on function public.list_organization_pending_invites(uuid) to authenticated;
grant execute on function public.get_organization_invite_preview(text) to authenticated, anon;
grant execute on function public.create_organization_invite(uuid, text, text, text) to authenticated;
grant execute on function public.revoke_organization_invite(uuid) to authenticated;
grant execute on function public.accept_organization_invite(text) to authenticated;
grant execute on function public.change_organization_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_organization_member(uuid, uuid) to authenticated;
