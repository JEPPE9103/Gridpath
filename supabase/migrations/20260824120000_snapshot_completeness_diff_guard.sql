-- Refuse observation diffs unless both snapshots finished normalization.
-- Identical content_hash is not a substitute for a complete normalized snapshot.

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
  previous_snap public.source_snapshots%rowtype;
begin
  if p_previous_snapshot_id is null or p_current_snapshot_id is null then
    return;
  end if;

  select * into current_snap
  from public.source_snapshots
  where id = p_current_snapshot_id;

  select * into previous_snap
  from public.source_snapshots
  where id = p_previous_snapshot_id;

  if current_snap.id is null or previous_snap.id is null then
    return;
  end if;

  if current_snap.status not in ('success', 'unchanged')
     or previous_snap.status not in ('success', 'unchanged') then
    raise exception
      'Refusing observation diff: previous status=% current status=%. Both snapshots must be complete.',
      previous_snap.status,
      current_snap.status;
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
  'Insert external_changes from observation-version diffs only when both snapshots are success/unchanged. Alerts only if p_create_alerts. Not a public RPC.';
