-- Immutable observation history per source snapshot, plus deterministic
-- observation-diff identity for external_changes.
-- grid_observations remains the current/latest normalized representation.
--
-- Observation versions are historical state. They are not available-capacity
-- records. change_type = capacity on NUP diffs means published forecast-
-- transfer-capacity NEED changed.

create table public.grid_observation_versions (
  id uuid primary key default gen_random_uuid(),
  source_snapshot_id uuid not null references public.source_snapshots (id) on delete cascade,
  source_id uuid not null references public.grid_sources (id) on delete cascade,
  external_id text not null,
  grid_area_id uuid references public.grid_areas (id) on delete set null,
  operator_id uuid references public.grid_operators (id) on delete set null,
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
  confidence text not null,
  authority_level text not null,
  source_url text,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint grid_observation_versions_external_id_not_blank
    check (char_length(trim(external_id)) > 0),
  constraint grid_observation_versions_type_check
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
  constraint grid_observation_versions_direction_check
    check (
      direction is null or direction in ('import', 'export', 'both', 'not_applicable')
    ),
  constraint grid_observation_versions_confidence_check
    check (confidence in ('high', 'medium', 'low', 'unknown')),
  constraint grid_observation_versions_authority_check
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

comment on table public.grid_observation_versions is
  'Immutable normalized observation state belonging to one source snapshot. Not latest-state. capacity_signal is not available MW.';

create unique index grid_observation_versions_snapshot_external_uidx
  on public.grid_observation_versions (source_snapshot_id, external_id);

create index grid_observation_versions_snapshot_id_idx
  on public.grid_observation_versions (source_snapshot_id);

create index grid_observation_versions_source_external_idx
  on public.grid_observation_versions (source_id, external_id);

create index grid_observation_versions_grid_area_id_idx
  on public.grid_observation_versions (grid_area_id);

alter table public.external_changes
  add column if not exists observation_external_id text;

comment on column public.external_changes.observation_external_id is
  'Source observation external_id for snapshot diffs. Null for non-observation changes.';

create unique index if not exists external_changes_observation_diff_uidx
  on public.external_changes (
    source_id,
    previous_snapshot_id,
    current_snapshot_id,
    observation_external_id
  )
  where observation_external_id is not null
    and previous_snapshot_id is not null;

comment on table public.grid_observations is
  'Current/latest normalized external-grid observations. Historical state lives in grid_observation_versions. capacity_signal is not guaranteed available MW.';

alter table public.grid_observation_versions enable row level security;
alter table public.grid_observation_versions force row level security;

create policy grid_observation_versions_select_authenticated
  on public.grid_observation_versions
  for select
  to authenticated
  using ((select auth.uid()) is not null);

grant select on table public.grid_observation_versions to authenticated;
revoke all on table public.grid_observation_versions from anon;

create or replace function private.observation_version_semantic_state(
  p_observation_type text,
  p_value_numeric numeric,
  p_value_text text,
  p_unit text,
  p_effective_from timestamptz,
  p_effective_to timestamptz,
  p_raw_metadata jsonb
)
returns jsonb
language sql
immutable
parallel safe
set search_path = ''
as $$
  select jsonb_strip_nulls(
    jsonb_build_object(
      'observation_type', p_observation_type,
      'value_numeric', to_jsonb(p_value_numeric),
      'value_text', p_value_text,
      'unit', p_unit,
      'effective_from', p_effective_from,
      'effective_to', p_effective_to,
      'semantic', p_raw_metadata ->> 'semantic',
      'planning_year', p_raw_metadata ->> 'planning_year',
      'horizon', p_raw_metadata ->> 'horizon',
      'original_value', p_raw_metadata ->> 'original_value',
      'representation', p_raw_metadata ->> 'representation'
    )
  );
$$;

create or replace function private.observation_change_payload(p_row public.grid_observation_versions)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_strip_nulls(
    jsonb_build_object(
      'value', case
        when p_row.value_numeric is not null then to_jsonb(p_row.value_numeric)
        else to_jsonb(p_row.value_text)
      end,
      'value_numeric', p_row.value_numeric,
      'value_text', p_row.value_text,
      'unit', p_row.unit,
      'year', nullif(p_row.raw_metadata ->> 'planning_year', ''),
      'horizon', p_row.raw_metadata ->> 'horizon',
      'semantic', p_row.raw_metadata ->> 'semantic',
      'representation', p_row.raw_metadata ->> 'representation'
    )
  );
$$;

create or replace function private.nup_change_type_for_semantic(p_semantic text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_semantic
    when 'forecast_transfer_capacity_need' then 'capacity'
    when 'planned_investments_reported' then 'reinforcement'
    when 'flexibility_need' then 'other'
    when 'planned_measures_meet_own_network_need' then 'constraint'
    when 'overlying_network_limitation' then 'constraint'
    else 'other'
  end;
$$;

create or replace function private.nup_change_title(p_kind text, p_semantic text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_kind = 'added' and p_semantic = 'forecast_transfer_capacity_need'
      then 'Published transfer-capacity forecast added'
    when p_kind = 'removed' and p_semantic = 'forecast_transfer_capacity_need'
      then 'Published transfer-capacity forecast removed'
    when p_kind = 'changed' and p_semantic = 'forecast_transfer_capacity_need'
      then 'Published transfer-capacity forecast changed'
    when p_kind = 'added' and p_semantic = 'planned_investments_reported'
      then 'Planned-investments reporting added'
    when p_kind = 'removed' and p_semantic = 'planned_investments_reported'
      then 'Planned-investments reporting removed'
    when p_kind = 'changed' and p_semantic = 'planned_investments_reported'
      then 'Planned-investments reporting changed'
    when p_kind = 'added' and p_semantic = 'flexibility_need'
      then 'Flexibility-need reporting added'
    when p_kind = 'removed' and p_semantic = 'flexibility_need'
      then 'Flexibility-need reporting removed'
    when p_kind = 'changed' and p_semantic = 'flexibility_need'
      then 'Flexibility-need reporting changed'
    when p_kind = 'added' and p_semantic = 'planned_measures_meet_own_network_need'
      then 'Planned-measures assessment added'
    when p_kind = 'removed' and p_semantic = 'planned_measures_meet_own_network_need'
      then 'Planned-measures assessment removed'
    when p_kind = 'changed' and p_semantic = 'planned_measures_meet_own_network_need'
      then 'Planned-measures assessment changed'
    when p_kind = 'added' and p_semantic = 'overlying_network_limitation'
      then 'Overlying-network limitation assessment added'
    when p_kind = 'removed' and p_semantic = 'overlying_network_limitation'
      then 'Overlying-network limitation assessment removed'
    when p_kind = 'changed' and p_semantic = 'overlying_network_limitation'
      then 'Overlying-network limitation assessment changed'
    when p_kind = 'added' then 'Published observation added'
    when p_kind = 'removed' then 'Published observation removed'
    else 'Published observation changed'
  end;
$$;

create or replace function private.copy_grid_observations_to_versions(p_snapshot_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer := 0;
begin
  if p_snapshot_id is null then
    return 0;
  end if;

  insert into public.grid_observation_versions (
    source_snapshot_id,
    source_id,
    external_id,
    grid_area_id,
    operator_id,
    observation_type,
    value_numeric,
    value_text,
    unit,
    technology,
    direction,
    voltage_kv,
    effective_from,
    effective_to,
    published_at,
    retrieved_at,
    confidence,
    authority_level,
    source_url,
    raw_metadata
  )
  select
    s.id,
    o.source_id,
    o.external_id,
    o.grid_area_id,
    o.operator_id,
    o.observation_type,
    o.value_numeric,
    o.value_text,
    o.unit,
    o.technology,
    o.direction,
    o.voltage_kv,
    o.effective_from,
    o.effective_to,
    o.published_at,
    o.retrieved_at,
    o.confidence,
    o.authority_level,
    o.source_url,
    o.raw_metadata
  from public.source_snapshots as s
  inner join public.grid_observations as o
    on o.source_id = s.source_id
  where s.id = p_snapshot_id
    and o.external_id is not null
    and char_length(trim(o.external_id)) > 0
  on conflict (source_snapshot_id, external_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

comment on function private.copy_grid_observations_to_versions(uuid) is
  'Copy current grid_observations into immutable versions for a snapshot. Idempotent. Not a public RPC.';

create or replace function private.diff_observation_snapshots(
  p_previous_snapshot_id uuid,
  p_current_snapshot_id uuid
)
returns table (
  change_kind text,
  external_id text,
  source_id uuid,
  grid_area_id uuid,
  semantic text,
  observation_type text,
  before_value jsonb,
  after_value jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with prev as (
    select *
    from public.grid_observation_versions
    where source_snapshot_id = p_previous_snapshot_id
  ),
  curr as (
    select *
    from public.grid_observation_versions
    where source_snapshot_id = p_current_snapshot_id
  )
  select
    'added'::text,
    c.external_id,
    c.source_id,
    c.grid_area_id,
    c.raw_metadata ->> 'semantic',
    c.observation_type,
    null::jsonb,
    private.observation_change_payload(c)
  from curr as c
  where not exists (select 1 from prev as p where p.external_id = c.external_id)

  union all

  select
    'removed'::text,
    p.external_id,
    p.source_id,
    p.grid_area_id,
    p.raw_metadata ->> 'semantic',
    p.observation_type,
    private.observation_change_payload(p),
    null::jsonb
  from prev as p
  where not exists (select 1 from curr as c where c.external_id = p.external_id)

  union all

  select
    'changed'::text,
    c.external_id,
    c.source_id,
    coalesce(c.grid_area_id, p.grid_area_id),
    c.raw_metadata ->> 'semantic',
    c.observation_type,
    private.observation_change_payload(p),
    private.observation_change_payload(c)
  from curr as c
  inner join prev as p
    on p.external_id = c.external_id
  where private.observation_version_semantic_state(
      p.observation_type, p.value_numeric, p.value_text, p.unit,
      p.effective_from, p.effective_to, p.raw_metadata
    ) is distinct from private.observation_version_semantic_state(
      c.observation_type, c.value_numeric, c.value_text, c.unit,
      c.effective_from, c.effective_to, c.raw_metadata
    );
$$;

comment on function private.diff_observation_snapshots(uuid, uuid) is
  'Compare immutable observation versions by external_id. Ignores retrieved_at and internal IDs. Not a public RPC.';

revoke all on function private.apply_geographic_change_impacts(uuid) from public, anon, authenticated;
drop function if exists private.apply_geographic_change_impacts(uuid);

create function private.apply_geographic_change_impacts(
  p_external_change_id uuid,
  p_reason text default null,
  p_confidence text default null
)
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
      coalesce(
        nullif(trim(p_reason), ''),
        'Project site''s primary coordinate intersects the geographic area associated with this source change.'
      ),
      case
        when p_confidence in ('high', 'medium', 'low', 'unknown') then p_confidence
        else 'medium'
      end,
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

comment on function private.apply_geographic_change_impacts(uuid, text, text) is
  'Internal PostGIS change-impact insert. Does not create alerts. Not a public RPC.';

create or replace function private.apply_observation_snapshot_changes(
  p_previous_snapshot_id uuid,
  p_current_snapshot_id uuid,
  p_create_alerts boolean default false,
  p_impact_reason text default null,
  p_impact_confidence text default 'medium'
)
returns table (
  change_id uuid,
  change_kind text,
  observation_external_id text,
  semantic text,
  inserted boolean,
  impact_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  diff_row record;
  new_id uuid;
  was_inserted boolean;
  impacts integer;
  current_snap public.source_snapshots%rowtype;
begin
  if p_previous_snapshot_id is null or p_current_snapshot_id is null then
    return;
  end if;

  select * into current_snap
  from public.source_snapshots
  where id = p_current_snapshot_id;

  if current_snap.id is null then
    return;
  end if;

  for diff_row in
    select *
    from private.diff_observation_snapshots(p_previous_snapshot_id, p_current_snapshot_id)
  loop
    new_id := null;
    insert into public.external_changes (
      source_id,
      previous_snapshot_id,
      current_snapshot_id,
      observation_external_id,
      change_type,
      title,
      summary,
      severity,
      grid_area_id,
      detected_at,
      published_at,
      confidence,
      source_url,
      before_value,
      after_value,
      metadata
    )
    select
      diff_row.source_id,
      p_previous_snapshot_id,
      p_current_snapshot_id,
      diff_row.external_id,
      private.nup_change_type_for_semantic(diff_row.semantic),
      private.nup_change_title(diff_row.change_kind, diff_row.semantic),
      case
        when diff_row.semantic = 'forecast_transfer_capacity_need'
          then 'Published forecast need for transfer capacity changed. This is not a statement of available connection capacity or grid headroom.'
        else 'Published source observation changed. Operational significance is not inferred.'
      end,
      'info',
      diff_row.grid_area_id,
      now(),
      current_snap.published_at,
      coalesce(nullif(p_impact_confidence, ''), 'medium'),
      null,
      diff_row.before_value,
      diff_row.after_value,
      jsonb_strip_nulls(
        jsonb_build_object(
          'observation_external_id', diff_row.external_id,
          'change_kind', diff_row.change_kind,
          'semantic', diff_row.semantic,
          'not_available_capacity', true
        )
      )
    where not exists (
      select 1
      from public.external_changes as existing
      where existing.source_id = diff_row.source_id
        and existing.previous_snapshot_id = p_previous_snapshot_id
        and existing.current_snapshot_id = p_current_snapshot_id
        and existing.observation_external_id = diff_row.external_id
    )
    returning public.external_changes.id into new_id;

    was_inserted := new_id is not null;
    if new_id is null then
      select existing.id
      into new_id
      from public.external_changes as existing
      where existing.source_id = diff_row.source_id
        and existing.previous_snapshot_id = p_previous_snapshot_id
        and existing.current_snapshot_id = p_current_snapshot_id
        and existing.observation_external_id = diff_row.external_id;
    end if;

    impacts := 0;
    if new_id is not null then
      select count(*)::integer
      into impacts
      from private.apply_geographic_change_impacts(
        new_id,
        p_impact_reason,
        p_impact_confidence
      );

      if p_create_alerts then
        perform 1
        from private.create_alerts_from_change_impacts(new_id);
      end if;
    end if;

    change_id := new_id;
    change_kind := diff_row.change_kind;
    observation_external_id := diff_row.external_id;
    semantic := diff_row.semantic;
    inserted := was_inserted;
    impact_count := coalesce(impacts, 0);
    return next;
  end loop;
end;
$$;

comment on function private.apply_observation_snapshot_changes(uuid, uuid, boolean, text, text) is
  'Insert external_changes from observation-version diffs and optionally spatial change_impacts. Alerts only if p_create_alerts. Not a public RPC.';

revoke all on function private.observation_version_semantic_state(text, numeric, text, text, timestamptz, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function private.observation_change_payload(public.grid_observation_versions) from public, anon, authenticated;
revoke all on function private.nup_change_type_for_semantic(text) from public, anon, authenticated;
revoke all on function private.nup_change_title(text, text) from public, anon, authenticated;
revoke all on function private.copy_grid_observations_to_versions(uuid) from public, anon, authenticated;
revoke all on function private.diff_observation_snapshots(uuid, uuid) from public, anon, authenticated;
revoke all on function private.apply_geographic_change_impacts(uuid, text, text) from public, anon, authenticated;
revoke all on function private.apply_observation_snapshot_changes(uuid, uuid, boolean, text, text) from public, anon, authenticated;

-- Baseline backfill: existing official NUP snapshot gets versions if observations exist.
-- Does not create external_changes or alerts.
do $$
declare
  snap_id uuid;
  copied integer;
begin
  select ss.id
  into snap_id
  from public.source_snapshots as ss
  inner join public.grid_sources as gs
    on gs.id = ss.source_id
  where gs.slug = 'ei-network-development-plans'
    and ss.status in ('success', 'unchanged')
  order by ss.retrieved_at desc
  limit 1;

  if snap_id is not null then
    copied := private.copy_grid_observations_to_versions(snap_id);
    raise notice 'Backfilled % Ei NUP observation versions for snapshot %', copied, snap_id;
  end if;
end $$;
