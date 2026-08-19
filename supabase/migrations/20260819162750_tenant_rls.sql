-- Tenant isolation for customer-owned tables.
-- Helper functions live in `private` so they can read memberships without RLS recursion.
-- grid_operators is a shared catalog: authenticated read, no client writes.

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

-- SECURITY DEFINER: policies on many tables need membership lookups without recursing into
-- organization_members RLS.
create or replace function private.belongs_to_organization(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as m
    where m.organization_id = org_id
      and m.profile_id = (select auth.uid())
  );
$$;

create or replace function private.organization_role(org_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.organization_members as m
  where m.organization_id = org_id
    and m.profile_id = (select auth.uid())
  limit 1;
$$;

create or replace function private.can_write_organization(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as m
    where m.organization_id = org_id
      and m.profile_id = (select auth.uid())
      and m.role in ('owner', 'admin', 'member')
  );
$$;

create or replace function private.is_organization_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as m
    where m.organization_id = org_id
      and m.profile_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function private.shares_organization_with(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as mine
    inner join public.organization_members as theirs
      on theirs.organization_id = mine.organization_id
    where mine.profile_id = (select auth.uid())
      and theirs.profile_id = target_profile_id
  );
$$;

create or replace function private.project_organization_id(p_project_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.organization_id
  from public.projects as p
  where p.id = p_project_id;
$$;

create or replace function private.belongs_to_project_organization(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.belongs_to_organization(private.project_organization_id(p_project_id));
$$;

create or replace function private.can_write_project_organization(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_write_organization(private.project_organization_id(p_project_id));
$$;

create or replace function private.is_project_organization_admin(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_organization_admin(private.project_organization_id(p_project_id));
$$;

create or replace function private.project_in_organization(p_project_id uuid, p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects as p
    where p.id = p_project_id
      and p.organization_id = p_org_id
  );
$$;

revoke all on function private.belongs_to_organization(uuid) from public;
revoke all on function private.organization_role(uuid) from public;
revoke all on function private.can_write_organization(uuid) from public;
revoke all on function private.is_organization_admin(uuid) from public;
revoke all on function private.shares_organization_with(uuid) from public;
revoke all on function private.project_organization_id(uuid) from public;
revoke all on function private.belongs_to_project_organization(uuid) from public;
revoke all on function private.can_write_project_organization(uuid) from public;
revoke all on function private.is_project_organization_admin(uuid) from public;
revoke all on function private.project_in_organization(uuid, uuid) from public;

grant execute on function private.belongs_to_organization(uuid) to authenticated;
grant execute on function private.organization_role(uuid) to authenticated;
grant execute on function private.can_write_organization(uuid) to authenticated;
grant execute on function private.is_organization_admin(uuid) to authenticated;
grant execute on function private.shares_organization_with(uuid) to authenticated;
grant execute on function private.project_organization_id(uuid) to authenticated;
grant execute on function private.belongs_to_project_organization(uuid) to authenticated;
grant execute on function private.can_write_project_organization(uuid) to authenticated;
grant execute on function private.is_project_organization_admin(uuid) to authenticated;
grant execute on function private.project_in_organization(uuid, uuid) to authenticated;

-- Signup must create a profile row before the user can join or create an organization.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create index if not exists organization_members_profile_id_organization_id_idx
  on public.organization_members (profile_id, organization_id);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_sites enable row level security;
alter table public.connection_cases enable row level security;
alter table public.project_requirements enable row level security;
alter table public.documents enable row level security;
alter table public.project_events enable row level security;
alter table public.alerts enable row level security;
alter table public.grid_operators enable row level security;

alter table public.organizations force row level security;
alter table public.profiles force row level security;
alter table public.organization_members force row level security;
alter table public.projects force row level security;
alter table public.project_sites force row level security;
alter table public.connection_cases force row level security;
alter table public.project_requirements force row level security;
alter table public.documents force row level security;
alter table public.project_events force row level security;
alter table public.alerts force row level security;
alter table public.grid_operators force row level security;

-- profiles
create policy profiles_select_authenticated
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or private.shares_organization_with(id)
  );

create policy profiles_update_authenticated
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- organizations
-- Client inserts are denied. New tenants are created via public.create_workspace().
-- postgres/service_role still insert directly (BYPASSRLS) for seed/admin SQL.
create policy organizations_select_authenticated
  on public.organizations
  for select
  to authenticated
  using (private.belongs_to_organization(id));

create policy organizations_update_authenticated
  on public.organizations
  for update
  to authenticated
  using (private.is_organization_admin(id))
  with check (private.is_organization_admin(id));

create policy organizations_delete_authenticated
  on public.organizations
  for delete
  to authenticated
  using (private.organization_role(id) = 'owner');

-- organization_members
create policy organization_members_select_authenticated
  on public.organization_members
  for select
  to authenticated
  using (private.belongs_to_organization(organization_id));

create policy organization_members_insert_authenticated
  on public.organization_members
  for insert
  to authenticated
  with check (
    private.is_organization_admin(organization_id)
    and profile_id <> (select auth.uid())
  );

-- Admins may change other members' roles, never their own (blocks self-escalation).
create policy organization_members_update_authenticated
  on public.organization_members
  for update
  to authenticated
  using (
    private.is_organization_admin(organization_id)
    and profile_id <> (select auth.uid())
  )
  with check (
    private.is_organization_admin(organization_id)
    and profile_id <> (select auth.uid())
  );

create policy organization_members_delete_authenticated
  on public.organization_members
  for delete
  to authenticated
  using (
    (
      private.is_organization_admin(organization_id)
      and profile_id <> (select auth.uid())
    )
    or profile_id = (select auth.uid())
  );

-- projects
create policy projects_select_authenticated
  on public.projects
  for select
  to authenticated
  using (private.belongs_to_organization(organization_id));

create policy projects_insert_authenticated
  on public.projects
  for insert
  to authenticated
  with check (private.can_write_organization(organization_id));

create policy projects_update_authenticated
  on public.projects
  for update
  to authenticated
  using (private.can_write_organization(organization_id))
  with check (private.can_write_organization(organization_id));

create policy projects_delete_authenticated
  on public.projects
  for delete
  to authenticated
  using (private.is_organization_admin(organization_id));

-- project_sites
create policy project_sites_select_authenticated
  on public.project_sites
  for select
  to authenticated
  using (private.belongs_to_project_organization(project_id));

create policy project_sites_insert_authenticated
  on public.project_sites
  for insert
  to authenticated
  with check (private.can_write_project_organization(project_id));

create policy project_sites_update_authenticated
  on public.project_sites
  for update
  to authenticated
  using (private.can_write_project_organization(project_id))
  with check (private.can_write_project_organization(project_id));

create policy project_sites_delete_authenticated
  on public.project_sites
  for delete
  to authenticated
  using (private.is_project_organization_admin(project_id));

-- connection_cases
create policy connection_cases_select_authenticated
  on public.connection_cases
  for select
  to authenticated
  using (private.belongs_to_project_organization(project_id));

create policy connection_cases_insert_authenticated
  on public.connection_cases
  for insert
  to authenticated
  with check (private.can_write_project_organization(project_id));

create policy connection_cases_update_authenticated
  on public.connection_cases
  for update
  to authenticated
  using (private.can_write_project_organization(project_id))
  with check (private.can_write_project_organization(project_id));

create policy connection_cases_delete_authenticated
  on public.connection_cases
  for delete
  to authenticated
  using (private.is_project_organization_admin(project_id));

-- project_requirements
create policy project_requirements_select_authenticated
  on public.project_requirements
  for select
  to authenticated
  using (private.belongs_to_project_organization(project_id));

create policy project_requirements_insert_authenticated
  on public.project_requirements
  for insert
  to authenticated
  with check (private.can_write_project_organization(project_id));

create policy project_requirements_update_authenticated
  on public.project_requirements
  for update
  to authenticated
  using (private.can_write_project_organization(project_id))
  with check (private.can_write_project_organization(project_id));

create policy project_requirements_delete_authenticated
  on public.project_requirements
  for delete
  to authenticated
  using (private.is_project_organization_admin(project_id));

-- documents
create policy documents_select_authenticated
  on public.documents
  for select
  to authenticated
  using (private.belongs_to_project_organization(project_id));

create policy documents_insert_authenticated
  on public.documents
  for insert
  to authenticated
  with check (private.can_write_project_organization(project_id));

create policy documents_update_authenticated
  on public.documents
  for update
  to authenticated
  using (private.can_write_project_organization(project_id))
  with check (private.can_write_project_organization(project_id));

create policy documents_delete_authenticated
  on public.documents
  for delete
  to authenticated
  using (private.is_project_organization_admin(project_id));

-- project_events
create policy project_events_select_authenticated
  on public.project_events
  for select
  to authenticated
  using (private.belongs_to_project_organization(project_id));

create policy project_events_insert_authenticated
  on public.project_events
  for insert
  to authenticated
  with check (private.can_write_project_organization(project_id));

create policy project_events_update_authenticated
  on public.project_events
  for update
  to authenticated
  using (private.can_write_project_organization(project_id))
  with check (private.can_write_project_organization(project_id));

create policy project_events_delete_authenticated
  on public.project_events
  for delete
  to authenticated
  using (private.is_project_organization_admin(project_id));

-- alerts
create policy alerts_select_authenticated
  on public.alerts
  for select
  to authenticated
  using (private.belongs_to_organization(organization_id));

create policy alerts_insert_authenticated
  on public.alerts
  for insert
  to authenticated
  with check (
    private.can_write_organization(organization_id)
    and (
      project_id is null
      or private.project_in_organization(project_id, organization_id)
    )
  );

create policy alerts_update_authenticated
  on public.alerts
  for update
  to authenticated
  using (private.can_write_organization(organization_id))
  with check (
    private.can_write_organization(organization_id)
    and (
      project_id is null
      or private.project_in_organization(project_id, organization_id)
    )
  );

create policy alerts_delete_authenticated
  on public.alerts
  for delete
  to authenticated
  using (private.is_organization_admin(organization_id));

-- grid_operators: shared reference data, not tenant-owned.
create policy grid_operators_select_authenticated
  on public.grid_operators
  for select
  to authenticated
  using ((select auth.uid()) is not null);
