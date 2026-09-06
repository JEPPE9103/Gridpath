-- V1 release candidate: full-ingest cadence (ignore probe-only runs),
-- richer source-health fields, and a customer-safe column grant on run history.

-- Probe-only successes must not satisfy the scheduled full-ingest cadence.
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
    and r.status = 'success'
    and coalesce((r.metadata ->> 'probe_only')::boolean, false) = false;

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

drop function if exists public.list_source_health();

create function public.list_source_health()
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
  last_full_ingest_at timestamptz,
  last_snapshot_id uuid,
  last_snapshot_at timestamptz,
  last_source_change_at timestamptz,
  next_eligible_at timestamptz,
  last_run_probe_only boolean,
  last_run_full_ingest_required boolean,
  last_observations_processed integer,
  last_external_changes_created integer,
  last_impacts_created integer,
  is_running boolean
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
    full_ingest.completed_at,
    snap.id,
    snap.retrieved_at,
    changes.detected_at,
    case
      when full_ingest.completed_at is null then now()
      else full_ingest.completed_at + make_interval(hours => coalesce(gs.refresh_interval_hours, 168))
    end,
    coalesce((latest.metadata ->> 'probe_only')::boolean, false),
    coalesce((latest.metadata ->> 'full_ingest_required')::boolean, false),
    latest.observations_processed,
    latest.external_changes_created,
    latest.impacts_created,
    exists (
      select 1
      from public.source_ingestion_runs as running
      where running.grid_source_id = gs.id
        and running.status = 'running'
    )
  from public.grid_sources as gs
  left join lateral (
    select
      r.started_at,
      r.status,
      r.source_changed,
      r.error_code,
      r.metadata,
      r.completed_at,
      r.observations_processed,
      r.external_changes_created,
      r.impacts_created
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
    select r.completed_at
    from public.source_ingestion_runs as r
    where r.grid_source_id = gs.id
      and r.status = 'success'
      and coalesce((r.metadata ->> 'probe_only')::boolean, false) = false
    order by r.completed_at desc
    limit 1
  ) as full_ingest on true
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

-- Customers may see operational status, not sanitized-but-still-internal error text.
revoke select on table public.source_ingestion_runs from authenticated;
grant select (
  id,
  grid_source_id,
  started_at,
  completed_at,
  status,
  trigger_type,
  snapshot_id,
  source_changed,
  observations_processed,
  external_changes_created,
  impacts_created,
  error_code,
  metadata
) on table public.source_ingestion_runs to authenticated;

comment on column public.source_ingestion_runs.error_message is
  'Sanitized operator summary. Not granted to authenticated Data API clients.';

create index if not exists source_ingestion_runs_full_success_idx
  on public.source_ingestion_runs (grid_source_id, completed_at desc)
  where status = 'success';

create index if not exists notification_deliveries_status_idx
  on public.notification_deliveries (status, created_at desc);
