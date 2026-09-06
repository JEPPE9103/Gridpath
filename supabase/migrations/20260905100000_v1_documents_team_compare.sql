-- Phase 4–6: private project documents, invite resend, shared portfolio comparisons.
-- Do not apply to linked cloud from this change set.

-- ---------------------------------------------------------------------------
-- Documents: file metadata on the existing table
-- ---------------------------------------------------------------------------

alter table public.documents
  add column if not exists storage_path text,
  add column if not exists original_filename text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists uploaded_by uuid references public.profiles (id) on delete set null,
  add column if not exists uploaded_at timestamptz;

alter table public.documents
  drop constraint if exists documents_storage_complete_chk;

alter table public.documents
  add constraint documents_storage_complete_chk
  check (
    (
      storage_path is null
      and original_filename is null
      and mime_type is null
      and file_size_bytes is null
      and uploaded_at is null
    )
    or (
      storage_path is not null
      and char_length(btrim(storage_path)) > 0
      and original_filename is not null
      and char_length(btrim(original_filename)) > 0
      and mime_type is not null
      and char_length(btrim(mime_type)) > 0
      and file_size_bytes is not null
      and file_size_bytes >= 0
    )
  );

create unique index if not exists documents_storage_path_uidx
  on public.documents (storage_path)
  where storage_path is not null;

comment on column public.documents.storage_path is
  'Private Storage object path. Null means a legacy metadata-only row with no file.';

-- Members who can write workflow may delete document records (viewers cannot).
drop policy if exists documents_delete_authenticated on public.documents;

create policy documents_delete_authenticated
  on public.documents
  for delete
  to authenticated
  using (private.can_write_project_organization(project_id));

-- ---------------------------------------------------------------------------
-- Storage: private tenant-scoped project documents
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents',
  'project-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.project_document_storage_allowed(
  p_object_name text,
  p_write boolean
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_parts text[];
  v_org uuid;
  v_project uuid;
  v_document uuid;
begin
  if p_object_name is null or pg_catalog.btrim(p_object_name) = '' then
    return false;
  end if;

  v_parts := storage.foldername(p_object_name);
  if v_parts is null or pg_catalog.array_length(v_parts, 1) < 3 then
    return false;
  end if;

  begin
    v_org := v_parts[1]::uuid;
    v_project := v_parts[2]::uuid;
    v_document := v_parts[3]::uuid;
  exception
    when invalid_text_representation then
      return false;
  end;

  if v_org is null or v_project is null or v_document is null then
    return false;
  end if;

  if p_write then
    if not private.can_write_organization(v_org) then
      return false;
    end if;
  else
    if not private.belongs_to_organization(v_org) then
      return false;
    end if;
  end if;

  if not private.project_in_organization(v_project, v_org) then
    return false;
  end if;

  return exists (
    select 1
    from public.documents as d
    where d.id = v_document
      and d.project_id = v_project
  );
end;
$$;

revoke all on function private.project_document_storage_allowed(text, boolean) from public;
grant execute on function private.project_document_storage_allowed(text, boolean) to authenticated;

drop policy if exists project_documents_select_authenticated on storage.objects;
drop policy if exists project_documents_insert_authenticated on storage.objects;
drop policy if exists project_documents_update_authenticated on storage.objects;
drop policy if exists project_documents_delete_authenticated on storage.objects;

create policy project_documents_select_authenticated
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-documents'
    and private.project_document_storage_allowed(name, false)
  );

create policy project_documents_insert_authenticated
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-documents'
    and private.project_document_storage_allowed(name, true)
  );

create policy project_documents_delete_authenticated
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'project-documents'
    and private.project_document_storage_allowed(name, true)
  );

-- No UPDATE policy: objects are immutable; overwrite is not allowed.

-- ---------------------------------------------------------------------------
-- Team: resend invitation (rotate token, no duplicate pending invite)
-- ---------------------------------------------------------------------------

create or replace function public.resend_organization_invite(
  p_invite_id uuid,
  p_token_hash text
)
returns table (invite_id uuid, email text, invite_role text)
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

  if p_invite_id is null or p_token_hash is null or pg_catalog.btrim(p_token_hash) = '' then
    raise exception 'Invalid invitation' using errcode = '22023';
  end if;

  select i.* into v_invite
  from public.organization_invites as i
  where i.id = p_invite_id
  for update;

  if v_invite.id is null then
    raise exception 'Invite not found' using errcode = '22023';
  end if;

  v_actor_role := private.organization_role(v_invite.organization_id);
  if v_actor_role is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_actor_role not in ('owner', 'admin') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_actor_role = 'admin' and v_invite.role not in ('member', 'viewer') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if not private.can_grant_invite_role(v_actor_role, v_invite.role) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if v_invite.status = 'accepted' then
    raise exception 'Invite already accepted' using errcode = '22023';
  end if;

  if v_invite.status = 'revoked' then
    raise exception 'Invite revoked' using errcode = '42501';
  end if;

  if v_invite.status not in ('pending', 'expired') then
    raise exception 'Invite not active' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.organization_members as m
    inner join auth.users as u on u.id = m.profile_id
    where m.organization_id = v_invite.organization_id
      and private.normalize_email(u.email) = v_invite.email
  ) then
    raise exception 'Already a member' using errcode = '23505';
  end if;

  update public.organization_invites
  set
    token_hash = p_token_hash,
    status = 'pending',
    expires_at = now() + interval '7 days',
    revoked_at = null,
    accepted_at = null
  where id = p_invite_id
    and status in ('pending', 'expired');

  invite_id := p_invite_id;
  email := v_invite.email;
  invite_role := v_invite.role;
  return next;
end;
$$;

revoke all on function public.resend_organization_invite(uuid, text) from public, anon;
grant execute on function public.resend_organization_invite(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Shared portfolio comparisons
-- ---------------------------------------------------------------------------

create table if not exists public.portfolio_comparisons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolio_comparisons_name_not_blank check (char_length(btrim(name)) > 0),
  constraint portfolio_comparisons_name_length check (char_length(name) <= 120)
);

create table if not exists public.portfolio_comparison_projects (
  comparison_id uuid not null references public.portfolio_comparisons (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (comparison_id, project_id),
  constraint portfolio_comparison_projects_sort_order_chk check (sort_order >= 0)
);

create index if not exists portfolio_comparisons_organization_updated_idx
  on public.portfolio_comparisons (organization_id, updated_at desc);

create index if not exists portfolio_comparison_projects_project_id_idx
  on public.portfolio_comparison_projects (project_id);

create trigger portfolio_comparisons_set_updated_at
  before update on public.portfolio_comparisons
  for each row execute function public.set_updated_at();

create or replace function private.enforce_portfolio_comparison_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comparison_org uuid;
  v_project_org uuid;
  v_archived_at timestamptz;
  v_count integer;
begin
  select c.organization_id into v_comparison_org
  from public.portfolio_comparisons as c
  where c.id = new.comparison_id;

  if v_comparison_org is null then
    raise exception 'Comparison not found' using errcode = '22023';
  end if;

  select p.organization_id, p.archived_at into v_project_org, v_archived_at
  from public.projects as p
  where p.id = new.project_id;

  if v_project_org is null then
    raise exception 'Project not found' using errcode = '22023';
  end if;

  if v_project_org is distinct from v_comparison_org then
    raise exception 'Project must belong to the comparison organisation' using errcode = '42501';
  end if;

  if v_archived_at is not null then
    raise exception 'Archived project cannot be added to a comparison' using errcode = '22023';
  end if;

  select count(*) into v_count
  from public.portfolio_comparison_projects as cp
  where cp.comparison_id = new.comparison_id;

  if v_count >= 4 then
    raise exception 'Comparison limit is 4 projects' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists portfolio_comparison_projects_enforce on public.portfolio_comparison_projects;
create trigger portfolio_comparison_projects_enforce
  before insert on public.portfolio_comparison_projects
  for each row execute function private.enforce_portfolio_comparison_project();

create or replace function private.prevent_portfolio_comparison_org_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'Cannot change comparison organisation' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists portfolio_comparisons_prevent_org_change on public.portfolio_comparisons;
create trigger portfolio_comparisons_prevent_org_change
  before update on public.portfolio_comparisons
  for each row execute function private.prevent_portfolio_comparison_org_change();

alter table public.portfolio_comparisons enable row level security;
alter table public.portfolio_comparisons force row level security;
alter table public.portfolio_comparison_projects enable row level security;
alter table public.portfolio_comparison_projects force row level security;

revoke all on table public.portfolio_comparisons from public, anon;
revoke all on table public.portfolio_comparison_projects from public, anon;
grant select, insert, update, delete on table public.portfolio_comparisons to authenticated;
grant select, insert, update, delete on table public.portfolio_comparison_projects to authenticated;

drop policy if exists portfolio_comparisons_select_authenticated on public.portfolio_comparisons;
drop policy if exists portfolio_comparisons_insert_authenticated on public.portfolio_comparisons;
drop policy if exists portfolio_comparisons_update_authenticated on public.portfolio_comparisons;
drop policy if exists portfolio_comparisons_delete_authenticated on public.portfolio_comparisons;
drop policy if exists portfolio_comparison_projects_select_authenticated on public.portfolio_comparison_projects;
drop policy if exists portfolio_comparison_projects_insert_authenticated on public.portfolio_comparison_projects;
drop policy if exists portfolio_comparison_projects_update_authenticated on public.portfolio_comparison_projects;
drop policy if exists portfolio_comparison_projects_delete_authenticated on public.portfolio_comparison_projects;

create policy portfolio_comparisons_select_authenticated
  on public.portfolio_comparisons
  for select
  to authenticated
  using (private.belongs_to_organization(organization_id));

create policy portfolio_comparisons_insert_authenticated
  on public.portfolio_comparisons
  for insert
  to authenticated
  with check (private.can_write_organization(organization_id));

create policy portfolio_comparisons_update_authenticated
  on public.portfolio_comparisons
  for update
  to authenticated
  using (private.can_write_organization(organization_id))
  with check (private.can_write_organization(organization_id));

create policy portfolio_comparisons_delete_authenticated
  on public.portfolio_comparisons
  for delete
  to authenticated
  using (private.can_write_organization(organization_id));

create policy portfolio_comparison_projects_select_authenticated
  on public.portfolio_comparison_projects
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.portfolio_comparisons as c
      where c.id = comparison_id
        and private.belongs_to_organization(c.organization_id)
    )
  );

create policy portfolio_comparison_projects_insert_authenticated
  on public.portfolio_comparison_projects
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.portfolio_comparisons as c
      where c.id = comparison_id
        and private.can_write_organization(c.organization_id)
    )
  );

create policy portfolio_comparison_projects_update_authenticated
  on public.portfolio_comparison_projects
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.portfolio_comparisons as c
      where c.id = comparison_id
        and private.can_write_organization(c.organization_id)
    )
  )
  with check (
    exists (
      select 1
      from public.portfolio_comparisons as c
      where c.id = comparison_id
        and private.can_write_organization(c.organization_id)
    )
  );

create policy portfolio_comparison_projects_delete_authenticated
  on public.portfolio_comparison_projects
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.portfolio_comparisons as c
      where c.id = comparison_id
        and private.can_write_organization(c.organization_id)
    )
  );
