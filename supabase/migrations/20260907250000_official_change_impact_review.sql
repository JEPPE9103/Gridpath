-- Customer review loop for official change impacts.
-- Review state stays on change_impacts (org/project scoped).
-- Does not alter immutable external_changes.

alter table public.change_impacts
  add column if not exists review_note text;

comment on column public.change_impacts.review_note is
  'Optional organisation note on why an impact was confirmed or dismissed. Not official-source truth.';

create index if not exists change_impacts_org_review_idx
  on public.change_impacts (organization_id, review_status);

create or replace function public.review_organization_change_impact(
  p_impact_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  impact_org uuid;
  note_text text;
begin
  if p_impact_id is null or p_status not in ('confirmed', 'dismissed') then
    return jsonb_build_object('ok', false);
  end if;

  select ci.organization_id
    into impact_org
  from public.change_impacts as ci
  where ci.id = p_impact_id;

  if impact_org is null or not private.can_write_organization(impact_org) then
    return jsonb_build_object('ok', false);
  end if;

  note_text := nullif(btrim(coalesce(p_note, '')), '');
  if note_text is not null and char_length(note_text) > 500 then
    note_text := left(note_text, 500);
  end if;

  update public.change_impacts
  set
    review_status = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = note_text,
    updated_at = now()
  where id = p_impact_id
    and organization_id = impact_org;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  update public.alerts
  set
    status = 'resolved',
    updated_at = now()
  where organization_id = impact_org
    and status = 'open'
    and (
      natural_key = 'change_impact:' || p_impact_id::text
      or metadata ->> 'change_impact_id' = p_impact_id::text
    );

  return jsonb_build_object('ok', true, 'status', p_status);
end;
$$;

comment on function public.review_organization_change_impact(uuid, text, text) is
  'Org-scoped confirm/dismiss of a change impact. Resolves matching open alerts. Does not mutate external_changes.';

revoke all on function public.review_organization_change_impact(uuid, text, text) from public, anon;
grant execute on function public.review_organization_change_impact(uuid, text, text) to authenticated;

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
      'Published change may be relevant to ' || p.name,
      'A published record changed. This project geographically overlaps the affected official area. Review whether it is relevant — this is not a technical impact verdict.',
      coalesce(ec.summary, ec.title),
      'Review impact',
      '/changes?impact=' || ci.id::text,
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

comment on function private.create_alerts_from_change_impacts(uuid) is
  'Creates one open alert per unmatched change impact. Idempotent on natural_key. Not a public RPC.';

revoke all on function private.create_alerts_from_change_impacts(uuid) from public, anon, authenticated;
