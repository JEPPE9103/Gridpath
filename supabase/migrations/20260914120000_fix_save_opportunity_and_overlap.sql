-- Fix save_opportunity_from_run_candidate: RETURNS TABLE (opportunity_id, slug)
-- made the nested SELECT from create_development_opportunity ambiguous.
-- Also guarantee kept candidate interiors do not overlap after dissolve/dump.

create or replace function private.dedupe_overlapping_run_candidates(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_prior extensions.geometry;
  v_next extensions.geometry;
  v_ha numeric;
begin
  v_prior := null;

  for v_row in
    select c.id, c.geom
    from public.opportunity_run_candidates as c
    where c.run_id = p_run_id
      and c.excluded = false
      and c.geom is not null
    order by extensions.st_area(c.geom::extensions.geography) desc, c.id
  loop
    v_next := extensions.st_multi(
      extensions.st_collectionextract(
        extensions.st_makevalid(v_row.geom),
        3
      )
    );

    if v_prior is not null
      and v_next is not null
      and not extensions.st_isempty(v_next)
      and extensions.st_intersects(v_next, v_prior)
      and not extensions.st_touches(v_next, v_prior)
    then
      v_next := extensions.st_multi(
        extensions.st_collectionextract(
          extensions.st_makevalid(extensions.st_difference(v_next, v_prior)),
          3
        )
      );
    end if;

    if v_next is null or extensions.st_isempty(v_next) then
      delete from public.opportunity_run_candidates where id = v_row.id;
      continue;
    end if;

    v_ha := extensions.st_area(v_next::extensions.geography) / 10000.0;
    if v_ha < 0.5 then
      delete from public.opportunity_run_candidates where id = v_row.id;
      continue;
    end if;

    update public.opportunity_run_candidates
    set
      geom = v_next,
      centroid = extensions.st_centroid(v_next),
      latitude = extensions.st_y(extensions.st_centroid(v_next)),
      longitude = extensions.st_x(extensions.st_centroid(v_next)),
      usable_area_ha = v_ha,
      contiguous_area_ha = v_ha
    where id = v_row.id
      and not extensions.st_equals(geom, v_next);

    if v_prior is null then
      v_prior := v_next;
    else
      v_prior := extensions.st_unaryunion(extensions.st_collect(array[v_prior, v_next]));
    end if;
  end loop;
end;
$$;

create or replace function private.opportunity_run_candidates_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run uuid;
begin
  for v_run in select distinct run_id from new_rows
  loop
    perform private.dedupe_overlapping_run_candidates(v_run);
  end loop;
  return null;
end;
$$;

drop trigger if exists opportunity_run_candidates_dedupe on public.opportunity_run_candidates;
create trigger opportunity_run_candidates_dedupe
  after insert on public.opportunity_run_candidates
  referencing new table as new_rows
  for each statement
  execute function private.opportunity_run_candidates_after_insert();

create or replace function public.save_opportunity_from_run_candidate(p_candidate_id uuid)
returns table (opportunity_id uuid, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_role text;
  v_cand public.opportunity_run_candidates%rowtype;
  v_search public.opportunity_searches%rowtype;
  v_run public.opportunity_search_runs%rowtype;
  v_id uuid;
  v_slug text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_cand
  from public.opportunity_run_candidates
  where id = p_candidate_id;

  if v_cand.id is null then
    raise exception 'Candidate not found' using errcode = '22023';
  end if;

  if v_cand.saved_opportunity_id is not null then
    select o.id, o.slug into v_id, v_slug
    from public.development_opportunities as o
    where o.id = v_cand.saved_opportunity_id;
    opportunity_id := v_id;
    slug := v_slug;
    return next;
    return;
  end if;

  select m.role into v_role
  from public.organization_members as m
  where m.profile_id = v_user_id
    and m.organization_id = v_cand.organization_id;

  if v_role is null or v_role not in ('owner', 'admin', 'member') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select * into v_search from public.opportunity_searches where id = v_cand.search_id;
  select * into v_run from public.opportunity_search_runs where id = v_cand.run_id;

  select created.opportunity_id, created.slug
    into v_id, v_slug
  from public.create_development_opportunity(
    v_cand.organization_id,
    coalesce(v_search.name, v_cand.name) || ' · ' || v_cand.name,
    coalesce(v_search.technology, 'battery_storage'),
    coalesce(v_search.country, 'SE'),
    v_search.region,
    v_search.municipality,
    v_cand.latitude,
    v_cand.longitude,
    v_search.target_mw,
    v_search.target_mwh,
    v_cand.usable_area_ha,
    v_search.notes,
    v_cand.search_id,
    v_cand.recommendation,
    v_cand.recommendation_summary,
    v_cand.data_confidence,
    case
      when v_cand.recommendation = 'prioritise' then 'strong_candidate'
      when v_cand.recommendation = 'investigate' then 'screening'
      else 'identified'
    end
  ) as created;

  update public.development_opportunities
  set
    originating_run_id = v_cand.run_id,
    originating_candidate_id = v_cand.id,
    area_geom = v_cand.geom,
    usable_area_ha = v_cand.usable_area_ha,
    gross_area_ha = v_cand.gross_area_ha,
    contiguous_area_ha = v_cand.contiguous_area_ha,
    exclusion_breakdown = v_cand.exclusion_breakdown,
    screening_snapshot = jsonb_build_object(
      'candidateId', v_cand.id,
      'runId', v_cand.run_id,
      'searchId', v_cand.search_id,
      'rankingVersion', coalesce(v_cand.ranking_version, v_run.ranking_version, 'suitability-v2'),
      'methodologyVersion', v_run.methodology_version,
      'sourceVersions', coalesce(v_run.source_versions, '{}'::jsonb),
      'providerAvailability', coalesce(v_run.provider_availability, '{}'::jsonb),
      'criteria', coalesce(v_run.criteria, v_search.criteria, '{}'::jsonb),
      'screening', v_cand.screening,
      'exclusionBreakdown', v_cand.exclusion_breakdown,
      'contiguousAreaHa', v_cand.contiguous_area_ha,
      'usableAreaHa', v_cand.usable_area_ha,
      'grossAreaHa', v_cand.gross_area_ha,
      'recommendation', v_cand.recommendation,
      'dataConfidence', v_cand.data_confidence,
      'rank', v_cand.rank,
      'generatedAt', v_cand.created_at
    ),
    key_positive = v_cand.key_positive,
    key_risk = v_cand.key_risk,
    updated_at = now()
  where id = v_id
    and organization_id = v_cand.organization_id;

  update public.opportunity_run_candidates
  set saved_opportunity_id = v_id
  where id = v_cand.id;

  insert into public.opportunity_events (opportunity_id, organization_id, title, detail, source)
  values (
    v_id,
    v_cand.organization_id,
    'Saved from screening run',
    'Candidate area snapshot was saved as an opportunity. Later source refreshes do not rewrite this snapshot. This is not a land parcel and is not a connection finding.',
    'NOXHEIM Analysis'
  );

  opportunity_id := v_id;
  slug := v_slug;
  return next;
end;
$$;

revoke all on function public.save_opportunity_from_run_candidate(uuid) from public, anon;
grant execute on function public.save_opportunity_from_run_candidate(uuid) to authenticated, service_role;
