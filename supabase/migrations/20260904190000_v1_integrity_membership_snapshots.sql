-- V1 integrity and security:
-- 1. Organization membership writes go through SECURITY DEFINER RPCs only.
-- 2. Cross-table tenant/project integrity triggers.
-- 3. Authenticated clients cannot select source_snapshots.raw_content.

-- ---------------------------------------------------------------------------
-- Membership: revoke direct writes; keep SELECT; tighten leftover RLS
-- ---------------------------------------------------------------------------

revoke insert, update, delete on table public.organization_members from authenticated;

grant select on table public.organization_members to authenticated;

drop policy if exists organization_members_insert_authenticated on public.organization_members;
drop policy if exists organization_members_update_authenticated on public.organization_members;
drop policy if exists organization_members_delete_authenticated on public.organization_members;

-- Defense in depth if table grants are restored later.
create policy organization_members_insert_authenticated
  on public.organization_members
  for insert
  to authenticated
  with check (false);

create policy organization_members_update_authenticated
  on public.organization_members
  for update
  to authenticated
  using (false)
  with check (false);

create policy organization_members_delete_authenticated
  on public.organization_members
  for delete
  to authenticated
  using (false);

create or replace function public.leave_organization(p_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_owner_count integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select m.role into v_role
  from public.organization_members as m
  where m.organization_id = p_organization_id
    and m.profile_id = auth.uid();

  if v_role is null then
    raise exception 'Member not found' using errcode = '22023';
  end if;

  if v_role = 'owner' then
    v_owner_count := private.organization_owner_count(p_organization_id);
    if v_owner_count <= 1 then
      raise exception 'Last owner protection' using errcode = '42501';
    end if;
  end if;

  delete from public.organization_members
  where organization_id = p_organization_id
    and profile_id = auth.uid();
end;
$$;

revoke all on function public.leave_organization(uuid) from public, anon;
grant execute on function public.leave_organization(uuid) to authenticated;

comment on function public.leave_organization(uuid) is
  'Authenticated member leaves the organization. Blocked for the last owner.';

-- ---------------------------------------------------------------------------
-- Cross-project / cross-tenant integrity
-- ---------------------------------------------------------------------------

create or replace function private.enforce_requirement_case_same_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case_project uuid;
begin
  if new.connection_case_id is null then
    return new;
  end if;

  select c.project_id into v_case_project
  from public.connection_cases as c
  where c.id = new.connection_case_id;

  if v_case_project is null then
    raise exception 'Connection case not found' using errcode = '23503';
  end if;

  if v_case_project is distinct from new.project_id then
    raise exception 'Requirement connection case must belong to the same project'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists project_requirements_same_project_case on public.project_requirements;
create trigger project_requirements_same_project_case
  before insert or update of project_id, connection_case_id
  on public.project_requirements
  for each row
  execute function private.enforce_requirement_case_same_project();

create or replace function private.enforce_change_impact_project_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_org uuid;
begin
  select p.organization_id into v_project_org
  from public.projects as p
  where p.id = new.project_id;

  if v_project_org is null then
    raise exception 'Project not found' using errcode = '23503';
  end if;

  if v_project_org is distinct from new.organization_id then
    raise exception 'Change impact organization must match the project organization'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists change_impacts_project_organization on public.change_impacts;
create trigger change_impacts_project_organization
  before insert or update of organization_id, project_id
  on public.change_impacts
  for each row
  execute function private.enforce_change_impact_project_organization();

create or replace function private.enforce_alert_project_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_org uuid;
begin
  if new.project_id is null then
    return new;
  end if;

  select p.organization_id into v_project_org
  from public.projects as p
  where p.id = new.project_id;

  if v_project_org is null then
    raise exception 'Project not found' using errcode = '23503';
  end if;

  if v_project_org is distinct from new.organization_id then
    raise exception 'Alert organization must match the project organization'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists alerts_project_organization on public.alerts;
create trigger alerts_project_organization
  before insert or update of organization_id, project_id
  on public.alerts
  for each row
  execute function private.enforce_alert_project_organization();

-- ---------------------------------------------------------------------------
-- Raw ingest payloads are operator-only. Normalized GI remains readable.
-- ---------------------------------------------------------------------------

revoke select on table public.source_snapshots from authenticated;

grant select (
  id,
  source_id,
  retrieved_at,
  published_at,
  content_hash,
  storage_path,
  status,
  metadata,
  created_at
) on table public.source_snapshots to authenticated;

comment on column public.source_snapshots.raw_content is
  'Raw ingest payload. Not granted to authenticated Data API clients.';
