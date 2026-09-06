-- Monitor V1 + Alerts/Notifications.
-- Adds operational source-ingestion runs, cadence, workflow-alert reconciliation,
-- and notification delivery logging. Does not replace Grid Intelligence ingest/diff.

-- ---------------------------------------------------------------------------
-- Official source cadence (NOXHEIM check interval, not Ei publication frequency)
-- ---------------------------------------------------------------------------
alter table public.grid_sources
  add column if not exists refresh_interval_hours integer;

alter table public.grid_sources
  drop constraint if exists grid_sources_refresh_interval_hours_check;

alter table public.grid_sources
  add constraint grid_sources_refresh_interval_hours_check
  check (refresh_interval_hours is null or refresh_interval_hours >= 24);

comment on column public.grid_sources.refresh_interval_hours is
  'NOXHEIM operational check cadence in hours. Not a claim of official publication frequency.';

update public.grid_sources
set
  refresh_interval_hours = 168,
  update_frequency = 'NOXHEIM checks weekly; Ei publication is irregular'
where slug in ('ei-network-development-plans', 'ei-network-area-concessions')
  and refresh_interval_hours is null;

-- ---------------------------------------------------------------------------
-- source_ingestion_runs (global operational history; no secrets)
-- ---------------------------------------------------------------------------
create table public.source_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  grid_source_id uuid not null references public.grid_sources (id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null,
  trigger_type text not null,
  snapshot_id uuid references public.source_snapshots (id) on delete set null,
  source_changed boolean,
  observations_processed integer,
  external_changes_created integer,
  impacts_created integer,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint source_ingestion_runs_status_check
    check (status in ('running', 'success', 'failed', 'skipped')),
  constraint source_ingestion_runs_trigger_check
    check (trigger_type in ('manual', 'scheduled')),
  constraint source_ingestion_runs_error_message_len
    check (error_message is null or char_length(error_message) <= 280)
);

comment on table public.source_ingestion_runs is
  'Operational history for official-source refresh. Must never store credentials or raw payloads.';

create unique index source_ingestion_runs_one_running_uidx
  on public.source_ingestion_runs (grid_source_id)
  where status = 'running';

create index source_ingestion_runs_source_started_idx
  on public.source_ingestion_runs (grid_source_id, started_at desc);

create index source_ingestion_runs_status_idx
  on public.source_ingestion_runs (status, started_at desc);

alter table public.source_ingestion_runs enable row level security;
alter table public.source_ingestion_runs force row level security;

create policy source_ingestion_runs_select_authenticated
  on public.source_ingestion_runs
  for select
  to authenticated
  using ((select auth.uid()) is not null);

grant select on table public.source_ingestion_runs to authenticated;
revoke insert, update, delete on table public.source_ingestion_runs from authenticated;
revoke all on table public.source_ingestion_runs from anon;

-- ---------------------------------------------------------------------------
-- Alert lifecycle columns (status already includes resolved)
-- ---------------------------------------------------------------------------
alter table public.alerts
  add column if not exists alert_type text,
  add column if not exists natural_key text;

alter table public.alerts
  drop constraint if exists alerts_alert_type_check;

alter table public.alerts
  add constraint alerts_alert_type_check
  check (
    alert_type is null
    or alert_type in (
      'external_change',
      'requirement_deadline',
      'connection_deadline'
    )
  );

comment on column public.alerts.alert_type is
  'Customer-facing alert class. Distinct from change_impacts and attention.';

comment on column public.alerts.natural_key is
  'Idempotency key for open alerts (for example change_impact:<id>).';

comment on column public.alerts.status is
  'open = actionable; dismissed = user closed; resolved = underlying condition gone. Not a read/unread flag.';

update public.alerts
set
  alert_type = 'external_change',
  natural_key = 'change_impact:' || (metadata ->> 'change_impact_id')
where metadata ? 'change_impact_id'
  and natural_key is null
  and coalesce(metadata ->> 'change_impact_id', '') <> '';

create unique index alerts_open_natural_key_uidx
  on public.alerts (organization_id, natural_key)
  where status = 'open' and natural_key is not null;

create index alerts_organization_status_created_idx
  on public.alerts (organization_id, status, created_at desc);

create index alerts_alert_type_idx
  on public.alerts (organization_id, alert_type, status);

create unique index if not exists external_changes_snapshot_observation_uidx
  on public.external_changes (
    source_id,
    previous_snapshot_id,
    current_snapshot_id,
    observation_external_id
  )
  where observation_external_id is not null
    and previous_snapshot_id is not null;

create index if not exists project_requirements_open_due_idx
  on public.project_requirements (due_date)
  where required = true and status <> 'complete' and due_date is not null;

create index if not exists connection_cases_open_deadline_idx
  on public.connection_cases (deadline)
  where deadline is not null
    and status not in ('complete', 'cancelled');

create index if not exists change_impacts_org_created_idx
  on public.change_impacts (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Notification preferences + delivery log
-- ---------------------------------------------------------------------------
create table public.organization_notification_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  digest_enabled boolean not null default true,
  impact_email_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organization_notification_settings is
  'Minimal org email preferences. Missing row means both channels enabled.';

create trigger organization_notification_settings_set_updated_at
  before update on public.organization_notification_settings
  for each row execute function public.set_updated_at();

alter table public.organization_notification_settings enable row level security;
alter table public.organization_notification_settings force row level security;

create policy organization_notification_settings_select
  on public.organization_notification_settings
  for select
  to authenticated
  using (private.belongs_to_organization(organization_id));

create policy organization_notification_settings_insert
  on public.organization_notification_settings
  for insert
  to authenticated
  with check (private.is_organization_admin(organization_id));

create policy organization_notification_settings_update
  on public.organization_notification_settings
  for update
  to authenticated
  using (private.is_organization_admin(organization_id))
  with check (private.is_organization_admin(organization_id));

grant select, insert, update on table public.organization_notification_settings to authenticated;
revoke all on table public.organization_notification_settings from anon;
revoke delete on table public.organization_notification_settings from authenticated;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null,
  status text not null,
  period_key text not null,
  alert_id uuid references public.alerts (id) on delete set null,
  provider text,
  provider_message_id text,
  recipient_count integer not null default 0,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_deliveries_kind_check
    check (kind in ('impact_email', 'weekly_digest')),
  constraint notification_deliveries_status_check
    check (status in ('attempted', 'accepted', 'failed')),
  constraint notification_deliveries_period_key_not_blank
    check (char_length(trim(period_key)) > 0)
);

comment on table public.notification_deliveries is
  'Operational email attempt log. Does not store bodies, recipients, or API keys.';

create unique index notification_deliveries_org_kind_period_uidx
  on public.notification_deliveries (organization_id, kind, period_key);

create index notification_deliveries_org_created_idx
  on public.notification_deliveries (organization_id, created_at desc);

create trigger notification_deliveries_set_updated_at
  before update on public.notification_deliveries
  for each row execute function public.set_updated_at();

alter table public.notification_deliveries enable row level security;
alter table public.notification_deliveries force row level security;

create policy notification_deliveries_select
  on public.notification_deliveries
  for select
  to authenticated
  using (private.belongs_to_organization(organization_id));

grant select on table public.notification_deliveries to authenticated;
revoke insert, update, delete on table public.notification_deliveries from authenticated;
revoke all on table public.notification_deliveries from anon;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function private.sanitize_ingestion_error(p_message text)
returns text
language sql
immutable
as $$
  select left(
    regexp_replace(
      regexp_replace(coalesce(p_message, ''), '://[^/\s]+@', '://***@', 'g'),
      '(service_role|eyJ[A-Za-z0-9_-]{20,})',
      '[redacted]',
      'g'
    ),
    280
  );
$$;

create or replace function private.sales_demo_organization_id()
returns uuid
language sql
immutable
as $$
  select 'ea5096a9-8da3-42e6-9dbd-64097414cb03'::uuid;
$$;

create or replace function private.monitor_today()
returns date
language sql
stable
as $$
  select (timezone('Europe/Stockholm', now()))::date;
$$;

create or replace function private.notification_prefs_enabled(
  p_organization_id uuid,
  p_kind text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_organization_id = private.sales_demo_organization_id() then false
    when p_kind = 'weekly_digest' then coalesce(s.digest_enabled, true)
    when p_kind = 'impact_email' then coalesce(s.impact_email_enabled, true)
    else false
  end
  from (select 1) as _
  left join public.organization_notification_settings as s
    on s.organization_id = p_organization_id;
$$;

-- Skip archived projects for new geographic matches.
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
    and p.archived_at is null
    and extensions.st_intersects(ga.geometry, ps.geom);
$$;

comment on function private.find_projects_in_grid_area(uuid) is
  'Internal PostGIS match: primary site vs grid area. Active (non-archived) projects only.';

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
      metadata,
      alert_type,
      natural_key
    )
    select
      ci.organization_id,
      ci.project_id,
      case
        when ec.severity in ('info', 'warning', 'positive') then ec.severity
        when ec.severity = 'critical' then 'warning'
        else 'info'
      end,
      'open',
      'Potentially relevant published change near ' || p.name,
      'Published network planning information changed. This project''s location overlaps the affected planning geography. Noxheim is not stating that the project will be negatively affected.',
      coalesce(ec.summary, ec.title),
      'Review change',
      '/changes',
      jsonb_build_object(
        'external_change_id', ec.id,
        'change_impact_id', ci.id,
        'source_id', ec.source_id,
        'match_type', ci.match_type
      ),
      'external_change',
      'change_impact:' || ci.id::text
    from public.change_impacts as ci
    inner join public.external_changes as ec
      on ec.id = ci.external_change_id
    inner join public.projects as p
      on p.id = ci.project_id
    where ci.external_change_id = p_external_change_id
      and p.archived_at is null
      and not exists (
        select 1
        from public.alerts as existing
        where existing.organization_id = ci.organization_id
          and (
            existing.natural_key = 'change_impact:' || ci.id::text
            or existing.metadata ->> 'change_impact_id' = ci.id::text
          )
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

revoke all on function private.create_alerts_from_change_impacts(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ingestion run control
-- ---------------------------------------------------------------------------
create or replace function private.begin_source_ingestion_run(
  p_source_slug text,
  p_trigger_type text
)
returns table (
  run_id uuid,
  source_id uuid,
  outcome text,
  error_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.grid_sources%rowtype;
  v_lock_key integer;
  v_locked boolean;
  v_last_success timestamptz;
  v_last_status text;
  v_interval integer;
  v_run_id uuid;
begin
  if p_trigger_type not in ('manual', 'scheduled') then
    raise exception 'Invalid trigger type' using errcode = '22023';
  end if;

  select *
    into v_source
  from public.grid_sources
  where slug = p_source_slug
    and active = true;

  if v_source.id is null then
    raise exception 'Unknown or inactive source' using errcode = '22023';
  end if;

  v_interval := coalesce(v_source.refresh_interval_hours, 168);
  v_lock_key := hashtext(v_source.id::text);

  update public.source_ingestion_runs
  set
    status = 'failed',
    completed_at = now(),
    error_code = 'stale_run',
    error_message = 'Run marked failed because it stayed running past the lock timeout.'
  where grid_source_id = v_source.id
    and status = 'running'
    and started_at < now() - interval '2 hours';

  select r.status
    into v_last_status
  from public.source_ingestion_runs as r
  where r.grid_source_id = v_source.id
  order by r.started_at desc
  limit 1;

  select max(r.completed_at)
    into v_last_success
  from public.source_ingestion_runs as r
  where r.grid_source_id = v_source.id
    and r.status = 'success';

  if p_trigger_type = 'scheduled'
     and coalesce(v_last_status, '') <> 'failed'
     and v_last_success is not null
     and now() < v_last_success + make_interval(hours => v_interval) then
    insert into public.source_ingestion_runs (
      grid_source_id, status, trigger_type, completed_at, error_code, metadata
    ) values (
      v_source.id, 'skipped', p_trigger_type, now(), 'not_due',
      jsonb_build_object('next_eligible_at', v_last_success + make_interval(hours => v_interval))
    )
    returning id into v_run_id;

    run_id := v_run_id;
    source_id := v_source.id;
    outcome := 'skipped_not_due';
    error_code := 'not_due';
    return next;
    return;
  end if;

  v_locked := pg_try_advisory_lock(918273, v_lock_key);
  if not v_locked then
    insert into public.source_ingestion_runs (
      grid_source_id, status, trigger_type, completed_at, error_code
    ) values (
      v_source.id, 'skipped', p_trigger_type, now(), 'already_running'
    )
    returning id into v_run_id;

    run_id := v_run_id;
    source_id := v_source.id;
    outcome := 'skipped_locked';
    error_code := 'already_running';
    return next;
    return;
  end if;

  begin
    insert into public.source_ingestion_runs (
      grid_source_id, status, trigger_type, metadata
    ) values (
      v_source.id, 'running', p_trigger_type, jsonb_build_object('lock_key', v_lock_key)
    )
    returning id into v_run_id;
  exception
    when unique_violation then
      perform pg_advisory_unlock(918273, v_lock_key);
      insert into public.source_ingestion_runs (
        grid_source_id, status, trigger_type, completed_at, error_code
      ) values (
        v_source.id, 'skipped', p_trigger_type, now(), 'already_running'
      )
      returning id into v_run_id;

      run_id := v_run_id;
      source_id := v_source.id;
      outcome := 'skipped_locked';
      error_code := 'already_running';
      return next;
      return;
  end;

  run_id := v_run_id;
  source_id := v_source.id;
  outcome := 'started';
  error_code := null;
  return next;
end;
$$;

create or replace function private.complete_source_ingestion_run(
  p_run_id uuid,
  p_status text,
  p_snapshot_id uuid default null,
  p_source_changed boolean default null,
  p_observations_processed integer default null,
  p_external_changes_created integer default null,
  p_impacts_created integer default null,
  p_error_code text default null,
  p_error_message text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
  v_lock_key integer;
begin
  if p_status not in ('success', 'failed', 'skipped') then
    raise exception 'Invalid run completion status' using errcode = '22023';
  end if;

  select grid_source_id
    into v_source_id
  from public.source_ingestion_runs
  where id = p_run_id
    and status = 'running';

  if v_source_id is null then
    raise exception 'No running ingestion run for this id' using errcode = 'P0002';
  end if;

  update public.source_ingestion_runs
  set
    status = p_status,
    completed_at = now(),
    snapshot_id = p_snapshot_id,
    source_changed = p_source_changed,
    observations_processed = p_observations_processed,
    external_changes_created = p_external_changes_created,
    impacts_created = p_impacts_created,
    error_code = p_error_code,
    error_message = private.sanitize_ingestion_error(p_error_message),
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb)
  where id = p_run_id;

  v_lock_key := hashtext(v_source_id::text);
  perform pg_advisory_unlock(918273, v_lock_key);
end;
$$;

revoke all on function private.begin_source_ingestion_run(text, text) from public, anon, authenticated;
revoke all on function private.complete_source_ingestion_run(uuid, text, uuid, boolean, integer, integer, integer, text, text, jsonb) from public, anon, authenticated;

create or replace function public.monitor_begin_source_run(
  p_source_slug text,
  p_trigger_type text
)
returns table (
  run_id uuid,
  source_id uuid,
  outcome text,
  error_code text
)
language sql
security definer
set search_path = ''
as $$
  select *
  from private.begin_source_ingestion_run(p_source_slug, p_trigger_type);
$$;

create or replace function public.monitor_complete_source_run(
  p_run_id uuid,
  p_status text,
  p_snapshot_id uuid default null,
  p_source_changed boolean default null,
  p_observations_processed integer default null,
  p_external_changes_created integer default null,
  p_impacts_created integer default null,
  p_error_code text default null,
  p_error_message text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.complete_source_ingestion_run(
    p_run_id,
    p_status,
    p_snapshot_id,
    p_source_changed,
    p_observations_processed,
    p_external_changes_created,
    p_impacts_created,
    p_error_code,
    p_error_message,
    p_metadata
  );
$$;

revoke all on function public.monitor_begin_source_run(text, text) from public, anon, authenticated;
revoke all on function public.monitor_complete_source_run(uuid, text, uuid, boolean, integer, integer, integer, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.monitor_begin_source_run(text, text) to service_role;
grant execute on function public.monitor_complete_source_run(uuid, text, uuid, boolean, integer, integer, integer, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Source health (authenticated; no raw payloads)
-- ---------------------------------------------------------------------------
create or replace function public.list_source_health()
returns table (
  source_id uuid,
  slug text,
  name text,
  publisher text,
  refresh_interval_hours integer,
  last_attempt_at timestamptz,
  last_attempt_status text,
  last_attempt_source_changed boolean,
  last_attempt_error_code text,
  last_success_at timestamptz,
  last_snapshot_id uuid,
  last_snapshot_at timestamptz,
  last_source_change_at timestamptz,
  next_eligible_at timestamptz,
  last_run_probe_only boolean,
  last_run_full_ingest_required boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    gs.id,
    gs.slug,
    gs.name,
    gs.publisher,
    coalesce(gs.refresh_interval_hours, 168),
    latest.started_at,
    latest.status,
    latest.source_changed,
    latest.error_code,
    success.completed_at,
    snap.id,
    snap.retrieved_at,
    changes.detected_at,
    case
      when success.completed_at is null then now()
      else success.completed_at + make_interval(hours => coalesce(gs.refresh_interval_hours, 168))
    end,
    coalesce((latest.metadata ->> 'probe_only')::boolean, false),
    coalesce((latest.metadata ->> 'full_ingest_required')::boolean, false)
  from public.grid_sources as gs
  left join lateral (
    select r.started_at, r.status, r.source_changed, r.error_code, r.metadata, r.completed_at
    from public.source_ingestion_runs as r
    where r.grid_source_id = gs.id
    order by r.started_at desc
    limit 1
  ) as latest on true
  left join lateral (
    select r.completed_at
    from public.source_ingestion_runs as r
    where r.grid_source_id = gs.id
      and r.status = 'success'
    order by r.completed_at desc
    limit 1
  ) as success on true
  left join lateral (
    select ss.id, ss.retrieved_at
    from public.source_snapshots as ss
    where ss.source_id = gs.id
      and ss.status in ('success', 'unchanged')
    order by ss.retrieved_at desc
    limit 1
  ) as snap on true
  left join lateral (
    select max(ec.detected_at) as detected_at
    from public.external_changes as ec
    where ec.source_id = gs.id
  ) as changes on true
  where gs.active
    and gs.slug in ('ei-network-development-plans', 'ei-network-area-concessions')
  order by gs.name;
$$;

revoke all on function public.list_source_health() from public, anon;
grant execute on function public.list_source_health() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Workflow alert reconciliation (set-based, idempotent)
-- ---------------------------------------------------------------------------
create or replace function private.reconcile_workflow_alerts()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.monitor_today();
  v_resolved_archived integer := 0;
  v_resolved_requirements integer := 0;
  v_inserted_requirements integer := 0;
  v_resolved_connections integer := 0;
  v_inserted_connections integer := 0;
begin
  with archived as (
    update public.alerts as a
    set status = 'resolved', updated_at = now()
    from public.projects as p
    where a.project_id = p.id
      and p.archived_at is not null
      and a.status = 'open'
    returning a.id
  )
  select count(*)::integer into v_resolved_archived from archived;

  with resolved as (
    update public.alerts as a
    set status = 'resolved', updated_at = now()
    where a.status = 'open'
      and a.alert_type = 'requirement_deadline'
      and not exists (
        select 1
        from public.project_requirements as r
        inner join public.projects as p
          on p.id = r.project_id
        where r.id::text = a.metadata ->> 'requirement_id'
          and p.archived_at is null
          and r.required
          and r.status <> 'complete'
          and r.due_date is not null
          and (
            (
              a.metadata ->> 'deadline_kind' = 'approaching'
              and r.due_date >= v_today
              and r.due_date <= v_today + 14
            )
            or (
              a.metadata ->> 'deadline_kind' = 'overdue'
              and r.due_date < v_today
            )
          )
      )
    returning a.id
  )
  select count(*)::integer into v_resolved_requirements from resolved;

  with due as (
    select
      p.organization_id,
      p.id as project_id,
      p.name as project_name,
      p.slug,
      r.id as requirement_id,
      r.label,
      r.due_date,
      case
        when r.due_date < v_today then 'overdue'
        else 'approaching'
      end as deadline_kind
    from public.project_requirements as r
    inner join public.projects as p
      on p.id = r.project_id
    where r.required
      and r.status <> 'complete'
      and r.due_date is not null
      and p.archived_at is null
      and r.due_date <= v_today + 14
  ),
  inserted as (
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
      metadata,
      alert_type,
      natural_key
    )
    select
      d.organization_id,
      d.project_id,
      'warning',
      'open',
      case
        when d.deadline_kind = 'overdue' then 'Required item overdue: ' || d.label
        else 'Required item due soon: ' || d.label
      end,
      case
        when d.deadline_kind = 'overdue' then 'A required project item is past its due date.'
        else 'A required project item is due within 14 days.'
      end,
      'Due ' || d.due_date::text || ' on ' || d.project_name || '.',
      'View project',
      '/projects/' || d.slug,
      jsonb_build_object(
        'requirement_id', d.requirement_id,
        'deadline_kind', d.deadline_kind
      ),
      'requirement_deadline',
      'requirement:' || d.requirement_id::text || ':' || d.deadline_kind
    from due as d
    where not exists (
      select 1
      from public.alerts as existing
      where existing.organization_id = d.organization_id
        and existing.natural_key = 'requirement:' || d.requirement_id::text || ':' || d.deadline_kind
        and existing.status in ('open', 'dismissed')
    )
    returning id
  )
  select count(*)::integer into v_inserted_requirements from inserted;

  with resolved as (
    update public.alerts as a
    set status = 'resolved', updated_at = now()
    where a.status = 'open'
      and a.alert_type = 'connection_deadline'
      and not exists (
        select 1
        from public.connection_cases as c
        inner join public.projects as p
          on p.id = c.project_id
        where c.id::text = a.metadata ->> 'connection_case_id'
          and p.archived_at is null
          and c.status not in ('complete', 'cancelled')
          and c.deadline is not null
          and (
            (
              a.metadata ->> 'deadline_kind' = 'approaching'
              and c.deadline >= v_today
              and c.deadline <= v_today + 14
            )
            or (
              a.metadata ->> 'deadline_kind' = 'overdue'
              and c.deadline < v_today
            )
          )
      )
    returning a.id
  )
  select count(*)::integer into v_resolved_connections from resolved;

  with due as (
    select
      p.organization_id,
      p.id as project_id,
      p.name as project_name,
      p.slug,
      c.id as case_id,
      c.deadline,
      case
        when c.deadline < v_today then 'overdue'
        else 'approaching'
      end as deadline_kind
    from public.connection_cases as c
    inner join public.projects as p
      on p.id = c.project_id
    where c.deadline is not null
      and c.status not in ('complete', 'cancelled')
      and p.archived_at is null
      and c.deadline <= v_today + 14
  ),
  inserted as (
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
      metadata,
      alert_type,
      natural_key
    )
    select
      d.organization_id,
      d.project_id,
      'warning',
      'open',
      case
        when d.deadline_kind = 'overdue' then 'Connection deadline overdue'
        else 'Connection deadline approaching'
      end,
      case
        when d.deadline_kind = 'overdue' then 'A connection-case deadline is past due.'
        else 'A connection-case deadline is due within 14 days.'
      end,
      'Deadline ' || d.deadline::text || ' on ' || d.project_name || '.',
      'View project',
      '/projects/' || d.slug,
      jsonb_build_object(
        'connection_case_id', d.case_id,
        'deadline_kind', d.deadline_kind
      ),
      'connection_deadline',
      'connection:' || d.case_id::text || ':' || d.deadline_kind
    from due as d
    where not exists (
      select 1
      from public.alerts as existing
      where existing.organization_id = d.organization_id
        and existing.natural_key = 'connection:' || d.case_id::text || ':' || d.deadline_kind
        and existing.status in ('open', 'dismissed')
    )
    returning id
  )
  select count(*)::integer into v_inserted_connections from inserted;

  return jsonb_build_object(
    'resolved_archived', v_resolved_archived,
    'resolved_requirements', v_resolved_requirements,
    'inserted_requirements', v_inserted_requirements,
    'resolved_connections', v_resolved_connections,
    'inserted_connections', v_inserted_connections
  );
end;
$$;

create or replace function public.monitor_reconcile_workflow_alerts()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.reconcile_workflow_alerts();
$$;

revoke all on function private.reconcile_workflow_alerts() from public, anon, authenticated;
revoke all on function public.monitor_reconcile_workflow_alerts() from public, anon, authenticated;
grant execute on function public.monitor_reconcile_workflow_alerts() to service_role;

-- ---------------------------------------------------------------------------
-- Notification candidate queries (service role)
-- ---------------------------------------------------------------------------
create or replace function public.monitor_list_undelivered_impact_emails()
returns table (
  organization_id uuid,
  organization_name text,
  alert_id uuid,
  project_name text,
  title text,
  source_name text,
  detected_at timestamptz,
  recipient_emails text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    a.organization_id,
    o.name,
    a.id,
    p.name,
    a.title,
    gs.name,
    a.created_at,
    coalesce((
      select array_agg(distinct u.email order by u.email)
      from public.organization_members as m
      inner join auth.users as u
        on u.id = m.profile_id
      where m.organization_id = a.organization_id
        and m.role in ('owner', 'admin')
        and u.email is not null
        and length(trim(u.email)) > 0
    ), '{}'::text[])
  from public.alerts as a
  inner join public.organizations as o
    on o.id = a.organization_id
  left join public.projects as p
    on p.id = a.project_id
  left join public.change_impacts as ci
    on ci.id::text = a.metadata ->> 'change_impact_id'
  left join public.external_changes as ec
    on ec.id = ci.external_change_id
  left join public.grid_sources as gs
    on gs.id = ec.source_id
  where a.status = 'open'
    and a.alert_type = 'external_change'
    and a.created_at >= now() - interval '7 days'
    and private.notification_prefs_enabled(a.organization_id, 'impact_email')
    and not exists (
      select 1
      from public.notification_deliveries as d
      where d.organization_id = a.organization_id
        and d.kind = 'impact_email'
        and d.period_key = 'alert:' || a.id::text
    )
  order by a.created_at
  limit 50;
$$;

create or replace function public.monitor_list_weekly_digests()
returns table (
  organization_id uuid,
  organization_name text,
  period_key text,
  recipient_emails text[],
  active_project_count integer,
  attention_project_count integer,
  new_impact_count integer,
  overdue_required_count integer,
  approaching_deadline_count integer,
  added_project_count integer,
  archived_project_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with orgs as (
    select o.id, o.name
    from public.organizations as o
    where private.notification_prefs_enabled(o.id, 'weekly_digest')
  ),
  period as (
    select 'digest:' || to_char(timezone('Europe/Stockholm', now()), 'IYYY-"W"IW') as period_key
  )
  select
    o.id,
    o.name,
    period.period_key,
    coalesce((
      select array_agg(distinct u.email order by u.email)
      from public.organization_members as m
      inner join auth.users as u
        on u.id = m.profile_id
      where m.organization_id = o.id
        and m.role in ('owner', 'admin')
        and u.email is not null
        and length(trim(u.email)) > 0
    ), '{}'::text[]),
    (
      select count(*)::integer
      from public.projects as p
      where p.organization_id = o.id
        and p.archived_at is null
    ),
    (
      select count(distinct p.id)::integer
      from public.projects as p
      where p.organization_id = o.id
        and p.archived_at is null
        and (
          exists (
            select 1
            from public.alerts as a
            where a.project_id = p.id
              and a.status = 'open'
              and a.severity in ('warning', 'critical')
          )
          or exists (
            select 1
            from public.project_requirements as r
            where r.project_id = p.id
              and r.required
              and r.status <> 'complete'
              and r.due_date is not null
              and r.due_date < private.monitor_today()
          )
        )
    ),
    (
      select count(*)::integer
      from public.change_impacts as ci
      where ci.organization_id = o.id
        and ci.created_at >= now() - interval '7 days'
    ),
    (
      select count(*)::integer
      from public.project_requirements as r
      inner join public.projects as p
        on p.id = r.project_id
      where p.organization_id = o.id
        and p.archived_at is null
        and r.required
        and r.status <> 'complete'
        and r.due_date is not null
        and r.due_date < private.monitor_today()
    ),
    (
      select count(*)::integer
      from public.connection_cases as c
      inner join public.projects as p
        on p.id = c.project_id
      where p.organization_id = o.id
        and p.archived_at is null
        and c.status not in ('complete', 'cancelled')
        and c.deadline is not null
        and c.deadline >= private.monitor_today()
        and c.deadline <= private.monitor_today() + 14
    ),
    (
      select count(*)::integer
      from public.projects as p
      where p.organization_id = o.id
        and p.created_at >= now() - interval '7 days'
    ),
    (
      select count(*)::integer
      from public.projects as p
      where p.organization_id = o.id
        and p.archived_at is not null
        and p.archived_at >= now() - interval '7 days'
    )
  from orgs as o
  cross join period
  where not exists (
    select 1
    from public.notification_deliveries as d
    where d.organization_id = o.id
      and d.kind = 'weekly_digest'
      and d.period_key = period.period_key
  );
$$;

create or replace function public.monitor_claim_notification_delivery(
  p_organization_id uuid,
  p_kind text,
  p_period_key text,
  p_alert_id uuid default null,
  p_recipient_count integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_organization_id = private.sales_demo_organization_id() then
    return null;
  end if;

  insert into public.notification_deliveries (
    organization_id,
    kind,
    status,
    period_key,
    alert_id,
    provider,
    recipient_count
  ) values (
    p_organization_id,
    p_kind,
    'attempted',
    p_period_key,
    p_alert_id,
    'resend',
    coalesce(p_recipient_count, 0)
  )
  on conflict (organization_id, kind, period_key) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.monitor_finish_notification_delivery(
  p_delivery_id uuid,
  p_status text,
  p_error_code text default null,
  p_provider_message_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('accepted', 'failed') then
    raise exception 'Invalid delivery status' using errcode = '22023';
  end if;

  update public.notification_deliveries
  set
    status = p_status,
    error_code = p_error_code,
    provider_message_id = p_provider_message_id,
    updated_at = now()
  where id = p_delivery_id
    and status = 'attempted';
end;
$$;

revoke all on function public.monitor_list_undelivered_impact_emails() from public, anon, authenticated;
revoke all on function public.monitor_list_weekly_digests() from public, anon, authenticated;
revoke all on function public.monitor_claim_notification_delivery(uuid, text, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.monitor_finish_notification_delivery(uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.monitor_list_undelivered_impact_emails() to service_role;
grant execute on function public.monitor_list_weekly_digests() to service_role;
grant execute on function public.monitor_claim_notification_delivery(uuid, text, text, uuid, integer) to service_role;
grant execute on function public.monitor_finish_notification_delivery(uuid, text, text, text) to service_role;
