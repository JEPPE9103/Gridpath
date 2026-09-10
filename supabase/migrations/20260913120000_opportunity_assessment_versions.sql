-- Record assessment versions when an opportunity screening snapshot is stored.
-- The precision-screening table existed without a writer.

create or replace function private.snapshot_opportunity_assessment_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.screening_snapshot is null or NEW.screening_snapshot = '{}'::jsonb then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and NEW.screening_snapshot is not distinct from OLD.screening_snapshot then
    return NEW;
  end if;

  insert into public.opportunity_assessment_versions (
    opportunity_id,
    organization_id,
    version_number,
    ranking_version,
    methodology_version,
    source_versions,
    contiguous_area_ha,
    usable_area_ha,
    snapshot,
    change_summary
  )
  values (
    NEW.id,
    NEW.organization_id,
    coalesce(
      (
        select max(v.version_number)
        from public.opportunity_assessment_versions as v
        where v.opportunity_id = NEW.id
      ),
      0
    ) + 1,
    NEW.screening_snapshot ->> 'rankingVersion',
    NEW.screening_snapshot ->> 'methodologyVersion',
    coalesce(NEW.screening_snapshot -> 'sourceVersions', '{}'::jsonb),
    NEW.contiguous_area_ha,
    NEW.usable_area_ha,
    NEW.screening_snapshot,
    'Assessment snapshot stored from screening.'
  );
  return NEW;
end;
$$;

drop trigger if exists opportunity_assessment_version_on_snapshot on public.development_opportunities;
create trigger opportunity_assessment_version_on_snapshot
  after insert or update of screening_snapshot on public.development_opportunities
  for each row
  execute function private.snapshot_opportunity_assessment_version();
