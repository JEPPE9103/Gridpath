-- Grid Intelligence foundation.
-- Global reference/intelligence tables plus organization-scoped change impacts.
-- Browser-authenticated clients may SELECT. Writes are for trusted workers only.
-- Do not treat fixture rows inserted by local scripts as operator-supplied data.

alter table public.alerts
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.alerts.metadata is
  'Structured provenance and linkage (for example external_change_id, change_impact_id). Not displayed as operator-supplied data.';

-- ---------------------------------------------------------------------------
-- grid_sources (global catalog)
-- ---------------------------------------------------------------------------
create table public.grid_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  source_type text not null,
  operator_id uuid references public.grid_operators (id) on delete set null,
  publisher text,
  base_url text,
  country_code text not null default 'SE',
  active boolean not null default true,
  authority_level text not null,
  update_frequency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grid_sources_name_not_blank check (char_length(trim(name)) > 0),
  constraint grid_sources_slug_not_blank check (char_length(trim(slug)) > 0),
  constraint grid_sources_slug_unique unique (slug),
  constraint grid_sources_type_check
    check (
      source_type in (
        'api',
        'gis',
        'csv',
        'excel',
        'pdf',
        'html',
        'manual',
        'licensed'
      )
    ),
  constraint grid_sources_authority_check
    check (
      authority_level in (
        'official',
        'operator',
        'regulator',
        'third_party',
        'customer',
        'noxheim'
      )
    )
);

create trigger grid_sources_set_updated_at
  before update on public.grid_sources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- grid_areas
-- ---------------------------------------------------------------------------
create table public.grid_areas (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.grid_sources (id) on delete cascade,
  operator_id uuid references public.grid_operators (id) on delete set null,
  external_id text,
  name text not null,
  area_type text not null default 'other',
  country_code text not null default 'SE',
  region text,
  geometry extensions.geometry(MultiPolygon, 4326),
  valid_from timestamptz,
  valid_to timestamptz,
  published_at timestamptz,
  retrieved_at timestamptz not null,
  confidence text not null default 'unknown',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grid_areas_name_not_blank check (char_length(trim(name)) > 0),
  constraint grid_areas_type_check
    check (
      area_type in (
        'local_network',
        'regional_network',
        'transmission_area',
        'capacity_area',
        'planning_area',
        'other'
      )
    ),
  constraint grid_areas_confidence_check
    check (confidence in ('high', 'medium', 'low', 'unknown'))
);

create trigger grid_areas_set_updated_at
  before update on public.grid_areas
  for each row execute function public.set_updated_at();

create unique index grid_areas_source_external_id_uidx
  on public.grid_areas (source_id, external_id)
  where external_id is not null;

create index grid_areas_source_id_idx on public.grid_areas (source_id);
create index grid_areas_operator_id_idx on public.grid_areas (operator_id);
create index grid_areas_external_id_idx on public.grid_areas (external_id);
create index grid_areas_retrieved_at_idx on public.grid_areas (retrieved_at desc);
create index grid_areas_geometry_gix on public.grid_areas using gist (geometry);

-- ---------------------------------------------------------------------------
-- source_snapshots
-- ---------------------------------------------------------------------------
create table public.source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.grid_sources (id) on delete cascade,
  retrieved_at timestamptz not null,
  published_at timestamptz,
  content_hash text not null,
  raw_content jsonb,
  storage_path text,
  status text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint source_snapshots_hash_not_blank check (char_length(trim(content_hash)) > 0),
  constraint source_snapshots_status_check
    check (status in ('success', 'unchanged', 'failed', 'partial')),
  constraint source_snapshots_source_hash_unique unique (source_id, content_hash)
);

create index source_snapshots_source_retrieved_idx
  on public.source_snapshots (source_id, retrieved_at desc);

-- ---------------------------------------------------------------------------
-- grid_observations
-- ---------------------------------------------------------------------------
create table public.grid_observations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.grid_sources (id) on delete cascade,
  grid_area_id uuid references public.grid_areas (id) on delete set null,
  operator_id uuid references public.grid_operators (id) on delete set null,
  external_id text,
  observation_type text not null,
  value_numeric numeric,
  value_text text,
  unit text,
  technology text,
  direction text,
  voltage_kv numeric,
  effective_from timestamptz,
  effective_to timestamptz,
  published_at timestamptz,
  retrieved_at timestamptz not null,
  confidence text not null default 'unknown',
  authority_level text not null,
  source_url text,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint grid_observations_type_check
    check (
      observation_type in (
        'capacity_signal',
        'connection_outlook',
        'reinforcement',
        'constraint',
        'timeline',
        'requirement',
        'tariff',
        'process',
        'other'
      )
    ),
  constraint grid_observations_direction_check
    check (
      direction is null or direction in ('import', 'export', 'both', 'not_applicable')
    ),
  constraint grid_observations_confidence_check
    check (confidence in ('high', 'medium', 'low', 'unknown')),
  constraint grid_observations_authority_check
    check (
      authority_level in (
        'official',
        'operator',
        'regulator',
        'third_party',
        'customer',
        'noxheim'
      )
    )
);

create index grid_observations_source_id_idx on public.grid_observations (source_id);
create index grid_observations_grid_area_id_idx on public.grid_observations (grid_area_id);
create index grid_observations_operator_id_idx on public.grid_observations (operator_id);
create index grid_observations_retrieved_at_idx on public.grid_observations (retrieved_at desc);

comment on table public.grid_observations is
  'Normalized external-grid observations. capacity_signal is not guaranteed available MW. Numeric MW is stored only when the source publishes a number and provenance is retained.';

-- ---------------------------------------------------------------------------
-- external_changes
-- ---------------------------------------------------------------------------
create table public.external_changes (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.grid_sources (id) on delete cascade,
  previous_snapshot_id uuid references public.source_snapshots (id) on delete set null,
  current_snapshot_id uuid not null references public.source_snapshots (id) on delete restrict,
  change_type text not null,
  title text not null,
  summary text,
  severity text not null,
  grid_area_id uuid references public.grid_areas (id) on delete set null,
  detected_at timestamptz not null,
  published_at timestamptz,
  confidence text not null default 'unknown',
  source_url text,
  before_value jsonb,
  after_value jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint external_changes_title_not_blank check (char_length(trim(title)) > 0),
  constraint external_changes_type_check
    check (
      change_type in (
        'capacity',
        'reinforcement',
        'constraint',
        'timeline',
        'requirement',
        'process',
        'tariff',
        'geography',
        'other'
      )
    ),
  constraint external_changes_severity_check
    check (severity in ('info', 'positive', 'warning', 'critical')),
  constraint external_changes_confidence_check
    check (confidence in ('high', 'medium', 'low', 'unknown'))
);

comment on column public.external_changes.severity is
  'NOXHEIM operational classification. Does not imply the source classified the change this way.';

create index external_changes_source_id_idx on public.external_changes (source_id);
create index external_changes_grid_area_id_idx on public.external_changes (grid_area_id);
create index external_changes_detected_at_idx on public.external_changes (detected_at desc);

-- ---------------------------------------------------------------------------
-- change_impacts (organization-scoped)
-- ---------------------------------------------------------------------------
create table public.change_impacts (
  id uuid primary key default gen_random_uuid(),
  external_change_id uuid not null references public.external_changes (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  match_type text not null,
  impact_level text not null,
  reason text not null,
  confidence text not null default 'unknown',
  review_status text not null default 'unreviewed',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint change_impacts_unique_change_project unique (external_change_id, project_id),
  constraint change_impacts_match_type_check
    check (match_type in ('geographic', 'operator', 'explicit', 'rule_based')),
  constraint change_impacts_level_check
    check (impact_level in ('informational', 'review', 'potentially_material')),
  constraint change_impacts_confidence_check
    check (confidence in ('high', 'medium', 'low', 'unknown')),
  constraint change_impacts_review_status_check
    check (review_status in ('unreviewed', 'confirmed', 'dismissed')),
  constraint change_impacts_reason_not_blank check (char_length(trim(reason)) > 0)
);

create trigger change_impacts_set_updated_at
  before update on public.change_impacts
  for each row execute function public.set_updated_at();

create index change_impacts_organization_id_idx on public.change_impacts (organization_id);
create index change_impacts_project_id_idx on public.change_impacts (project_id);
create index change_impacts_external_change_id_idx on public.change_impacts (external_change_id);

create unique index alerts_change_impact_id_uidx
  on public.alerts ((metadata ->> 'change_impact_id'))
  where metadata ->> 'change_impact_id' is not null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.grid_sources enable row level security;
alter table public.grid_areas enable row level security;
alter table public.grid_observations enable row level security;
alter table public.source_snapshots enable row level security;
alter table public.external_changes enable row level security;
alter table public.change_impacts enable row level security;

alter table public.grid_sources force row level security;
alter table public.grid_areas force row level security;
alter table public.grid_observations force row level security;
alter table public.source_snapshots force row level security;
alter table public.external_changes force row level security;
alter table public.change_impacts force row level security;

create policy grid_sources_select_authenticated
  on public.grid_sources
  for select
  to authenticated
  using ((select auth.uid()) is not null);

create policy grid_areas_select_authenticated
  on public.grid_areas
  for select
  to authenticated
  using ((select auth.uid()) is not null);

create policy grid_observations_select_authenticated
  on public.grid_observations
  for select
  to authenticated
  using ((select auth.uid()) is not null);

create policy source_snapshots_select_authenticated
  on public.source_snapshots
  for select
  to authenticated
  using ((select auth.uid()) is not null);

create policy external_changes_select_authenticated
  on public.external_changes
  for select
  to authenticated
  using ((select auth.uid()) is not null);

create policy change_impacts_select_authenticated
  on public.change_impacts
  for select
  to authenticated
  using (private.belongs_to_organization(organization_id));

create policy change_impacts_update_authenticated
  on public.change_impacts
  for update
  to authenticated
  using (private.can_write_organization(organization_id))
  with check (
    private.can_write_organization(organization_id)
    and (reviewed_by is null or reviewed_by = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Internal matching + impact/alert functions (not exposed as public RPC)
-- ---------------------------------------------------------------------------
create or replace function private.find_projects_in_grid_area(p_grid_area_id uuid)
returns table (project_id uuid, organization_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.organization_id
  from public.grid_areas as ga
  inner join public.project_sites as ps
    on ps.is_primary
   and ps.geom is not null
  inner join public.projects as p
    on p.id = ps.project_id
  where ga.id = p_grid_area_id
    and ga.geometry is not null
    and extensions.st_intersects(ga.geometry, ps.geom);
$$;

comment on function private.find_projects_in_grid_area(uuid) is
  'Internal PostGIS match: primary project_sites.geom vs grid_areas.geometry. Not a public RPC.';

create or replace function private.apply_geographic_change_impacts(p_external_change_id uuid)
returns table (
  change_impact_id uuid,
  project_id uuid,
  organization_id uuid,
  inserted boolean
)
language sql
security definer
set search_path = ''
as $$
  with change_row as (
    select id, grid_area_id
    from public.external_changes
    where id = p_external_change_id
  ),
  matched as (
    select found.project_id, found.organization_id
    from change_row as c
    cross join lateral private.find_projects_in_grid_area(c.grid_area_id) as found
    where c.grid_area_id is not null
  ),
  ins as (
    insert into public.change_impacts (
      external_change_id,
      organization_id,
      project_id,
      match_type,
      impact_level,
      reason,
      confidence,
      review_status
    )
    select
      (select id from change_row),
      matched.organization_id,
      matched.project_id,
      'geographic',
      'review',
      'Project site''s primary coordinate intersects the geographic area associated with this source change.',
      'medium',
      'unreviewed'
    from matched
    on conflict (external_change_id, project_id) do nothing
    returning id, project_id, organization_id
  ),
  existing as (
    select
      ci.id,
      ci.project_id,
      ci.organization_id
    from public.change_impacts as ci
    inner join matched as m
      on m.project_id = ci.project_id
    where ci.external_change_id = (select id from change_row)
      and not exists (
        select 1 from ins as i where i.project_id = ci.project_id
      )
  )
  select id, project_id, organization_id, true as inserted from ins
  union all
  select id, project_id, organization_id, false as inserted from existing;
$$;

create or replace function private.create_alerts_from_change_impacts(p_external_change_id uuid)
returns table (
  alert_id uuid,
  change_impact_id uuid,
  project_id uuid,
  inserted boolean
)
language sql
security definer
set search_path = ''
as $$
  with ins as (
    insert into public.alerts (
      organization_id,
      project_id,
      severity,
      status,
      title,
      summary,
      detail,
      cta_label,
      href,
      metadata
    )
    select
      ci.organization_id,
      ci.project_id,
      case
        when ec.severity in ('critical', 'warning', 'info', 'positive') then ec.severity
        else 'info'
      end,
      'open',
      'Grid information changed near ' || p.name,
      'Published grid information associated with this project''s area changed. Review the source and project impact.',
      coalesce(ec.summary, ec.title),
      'Review',
      '/projects/' || p.slug,
      jsonb_build_object(
        'external_change_id', ec.id,
        'change_impact_id', ci.id,
        'source_id', ec.source_id,
        'match_type', ci.match_type
      )
    from public.change_impacts as ci
    inner join public.external_changes as ec
      on ec.id = ci.external_change_id
    inner join public.projects as p
      on p.id = ci.project_id
    where ci.external_change_id = p_external_change_id
      and not exists (
        select 1
        from public.alerts as existing
        where existing.metadata ->> 'change_impact_id' = ci.id::text
      )
    returning id, (metadata ->> 'change_impact_id') as change_impact_id, project_id
  ),
  existing as (
    select
      a.id,
      (a.metadata ->> 'change_impact_id')::uuid as change_impact_id,
      a.project_id
    from public.alerts as a
    inner join public.change_impacts as ci
      on ci.id::text = a.metadata ->> 'change_impact_id'
    where ci.external_change_id = p_external_change_id
      and not exists (select 1 from ins as i where i.id = a.id)
  )
  select id, change_impact_id::uuid, project_id, true as inserted from ins
  union all
  select id, change_impact_id, project_id, false as inserted from existing;
$$;

revoke all on function private.find_projects_in_grid_area(uuid) from public, anon, authenticated;
revoke all on function private.apply_geographic_change_impacts(uuid) from public, anon, authenticated;
revoke all on function private.create_alerts_from_change_impacts(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Data API grants: authenticated SELECT only on intelligence catalogs.
-- change_impacts: SELECT plus review-column UPDATE. No anon grants.
-- ---------------------------------------------------------------------------
grant select on table public.grid_sources to authenticated;
grant select on table public.grid_areas to authenticated;
grant select on table public.grid_observations to authenticated;
grant select on table public.source_snapshots to authenticated;
grant select on table public.external_changes to authenticated;
grant select on table public.change_impacts to authenticated;
grant update (review_status, reviewed_by, reviewed_at) on table public.change_impacts to authenticated;

revoke all on table public.grid_sources from anon;
revoke all on table public.grid_areas from anon;
revoke all on table public.grid_observations from anon;
revoke all on table public.source_snapshots from anon;
revoke all on table public.external_changes from anon;
revoke all on table public.change_impacts from anon;
