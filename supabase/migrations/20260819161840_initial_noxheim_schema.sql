-- Initial NOXHEIM schema.
-- Site coordinates use PostGIS geometry(Point, 4326). RLS is added in a later migration.

create extension if not exists postgis with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (char_length(trim(name)) > 0),
  constraint organizations_slug_not_blank check (char_length(trim(slug)) > 0),
  constraint organizations_slug_unique unique (slug)
);

-- Deleting an organization cascades to members, projects and alerts. Project delete
-- then cascades to sites, cases, requirements, documents and events. This is tenant wipe.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Membership rows may disappear with the user; org-owned project rows must not.
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_role_check
    check (role in ('owner', 'admin', 'member', 'viewer')),
  constraint organization_members_unique_membership
    unique (organization_id, profile_id)
);

create table public.grid_operators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code text not null default 'SE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grid_operators_name_not_blank check (char_length(trim(name)) > 0),
  constraint grid_operators_name_unique unique (name)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  grid_operator_id uuid references public.grid_operators (id) on delete set null,
  -- Owner is attribution only. Deleting a user must not delete organization projects.
  owner_id uuid references public.profiles (id) on delete set null,
  name text not null,
  slug text not null,
  location text,
  region text,
  technology text,
  import_mw numeric,
  export_mw numeric,
  voltage_level text,
  connection_stage text not null default 'prospect',
  connection_outlook text not null default 'unknown',
  confidence text not null default 'unknown',
  target_cod text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_name_not_blank check (char_length(trim(name)) > 0),
  constraint projects_slug_not_blank check (char_length(trim(slug)) > 0),
  constraint projects_slug_unique_per_organization unique (organization_id, slug),
  constraint projects_technology_check
    check (
      technology is null or technology in (
        'battery_storage',
        'solar',
        'wind',
        'ev_infrastructure',
        'industrial',
        'other'
      )
    ),
  constraint projects_connection_stage_check
    check (
      connection_stage in (
        'prospect',
        'screened',
        'enquiry',
        'application',
        'grid_study',
        'offer',
        'agreement',
        'construction',
        'energisation'
      )
    ),
  constraint projects_connection_outlook_check
    check (
      connection_outlook in (
        'favourable',
        'possible',
        'at_risk',
        'weak',
        'unknown'
      )
    ),
  constraint projects_confidence_check
    check (confidence in ('high', 'medium', 'low', 'unknown')),
  constraint projects_import_mw_non_negative
    check (import_mw is null or import_mw >= 0),
  constraint projects_export_mw_non_negative
    check (export_mw is null or export_mw >= 0)
);

create table public.project_sites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text,
  location text,
  geom extensions.geometry(Point, 4326),
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One primary site per project so extra sites can be added later without a second "main" pin.
create unique index project_sites_one_primary_per_project
  on public.project_sites (project_id)
  where is_primary;

create table public.connection_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  grid_operator_id uuid references public.grid_operators (id) on delete set null,
  owner_id uuid references public.profiles (id) on delete set null,
  case_id text,
  stage text not null default 'prospect',
  status text not null default 'on_track',
  submitted_at date,
  next_milestone text,
  deadline date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connection_cases_stage_check
    check (
      stage in (
        'prospect',
        'screened',
        'enquiry',
        'application',
        'grid_study',
        'offer',
        'agreement',
        'construction',
        'energisation'
      )
    ),
  constraint connection_cases_status_check
    check (
      status in (
        'on_track',
        'waiting',
        'at_risk',
        'overdue',
        'complete',
        'cancelled'
      )
    )
);

create table public.project_requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  connection_case_id uuid references public.connection_cases (id) on delete set null,
  label text not null,
  status text not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_requirements_label_not_blank check (char_length(trim(label)) > 0),
  constraint project_requirements_status_check
    check (
      status in (
        'complete',
        'incomplete',
        'missing',
        'in_progress',
        'not_started'
      )
    )
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner_id uuid references public.profiles (id) on delete set null,
  name text not null,
  category text,
  status text not null default 'missing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_name_not_blank check (char_length(trim(name)) > 0),
  constraint documents_category_check
    check (
      category is null or category in (
        'technical',
        'land',
        'permit',
        'grid',
        'commercial',
        'other'
      )
    ),
  constraint documents_status_check
    check (
      status in (
        'missing',
        'draft',
        'in_progress',
        'complete'
      )
    )
);

create table public.project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null,
  detail text,
  source text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_events_title_not_blank check (char_length(trim(title)) > 0)
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- Alerts belong to the organization; dropping a project keeps the alert row.
  project_id uuid references public.projects (id) on delete set null,
  severity text not null,
  status text not null default 'open',
  title text not null,
  summary text,
  detail text,
  cta_label text,
  href text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint alerts_title_not_blank check (char_length(trim(title)) > 0),
  constraint alerts_severity_check
    check (severity in ('critical', 'warning', 'info', 'positive')),
  constraint alerts_status_check
    check (status in ('open', 'dismissed', 'resolved'))
);

create index organization_members_organization_id_idx
  on public.organization_members (organization_id);
create index organization_members_profile_id_idx
  on public.organization_members (profile_id);

create index projects_organization_id_idx
  on public.projects (organization_id);
create index projects_grid_operator_id_idx
  on public.projects (grid_operator_id);
create index projects_owner_id_idx
  on public.projects (owner_id);

create index project_sites_project_id_idx
  on public.project_sites (project_id);
create index project_sites_geom_gix
  on public.project_sites using gist (geom);

create index connection_cases_project_id_idx
  on public.connection_cases (project_id);
create index connection_cases_grid_operator_id_idx
  on public.connection_cases (grid_operator_id);
create index connection_cases_owner_id_idx
  on public.connection_cases (owner_id);

create index project_requirements_project_id_idx
  on public.project_requirements (project_id);
create index project_requirements_connection_case_id_idx
  on public.project_requirements (connection_case_id);

create index documents_project_id_idx
  on public.documents (project_id);
create index documents_owner_id_idx
  on public.documents (owner_id);

create index project_events_project_id_occurred_at_idx
  on public.project_events (project_id, occurred_at desc);

create index alerts_organization_id_idx
  on public.alerts (organization_id);
create index alerts_project_id_idx
  on public.alerts (project_id);
create index alerts_status_idx
  on public.alerts (status);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

create trigger grid_operators_set_updated_at
  before update on public.grid_operators
  for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger project_sites_set_updated_at
  before update on public.project_sites
  for each row execute function public.set_updated_at();

create trigger connection_cases_set_updated_at
  before update on public.connection_cases
  for each row execute function public.set_updated_at();

create trigger project_requirements_set_updated_at
  before update on public.project_requirements
  for each row execute function public.set_updated_at();

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create trigger project_events_set_updated_at
  before update on public.project_events
  for each row execute function public.set_updated_at();

create trigger alerts_set_updated_at
  before update on public.alerts
  for each row execute function public.set_updated_at();
