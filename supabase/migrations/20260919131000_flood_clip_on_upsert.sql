-- Clip mapped flood polygons to the ingest window on upsert so large BHF
-- geometries are not stored nationally in the product path.

create or replace function public.upsert_official_geographic_features(
  p_source_slug text,
  p_snapshot_id uuid,
  p_feature_class text,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source uuid;
  v_count integer := 0;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Official geographic upserts are server-side only' using errcode = '42501';
  end if;
  if p_feature_class not in ('protected_area', 'natura_2000', 'mapped_flood') then
    raise exception 'Invalid geographic feature class' using errcode = '22023';
  end if;
  select id into v_source from public.grid_sources where slug = p_source_slug;
  if v_source is null then
    raise exception 'Unknown source' using errcode = '22023';
  end if;

  insert into public.official_geographic_features (
    source_id, snapshot_id, feature_class, external_id, name, designation,
    geom, properties, source_version, fetched_at
  )
  select
    v_source,
    p_snapshot_id,
    p_feature_class,
    rec->>'id',
    nullif(rec->>'name', ''),
    nullif(rec->>'designation', ''),
    case
      when nullif(rec->>'clipWest', '') is not null
        and nullif(rec->>'clipSouth', '') is not null
        and nullif(rec->>'clipEast', '') is not null
        and nullif(rec->>'clipNorth', '') is not null
      then extensions.st_multi(
        extensions.st_collectionextract(
          extensions.st_makevalid(
            extensions.st_intersection(
              extensions.st_setsrid(extensions.st_geomfromgeojson(rec->>'geom'), 4326),
              extensions.st_setsrid(
                extensions.st_makeenvelope(
                  (rec->>'clipWest')::double precision,
                  (rec->>'clipSouth')::double precision,
                  (rec->>'clipEast')::double precision,
                  (rec->>'clipNorth')::double precision
                ),
                4326
              )
            )
          ),
          3
        )
      )
      else extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson(rec->>'geom'), 4326))
    end,
    coalesce(rec->'properties', '{}'::jsonb),
    nullif(rec->>'sourceVersion', ''),
    now()
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as rec
  where rec->>'id' is not null
    and rec->>'geom' is not null
    and (
      nullif(rec->>'clipWest', '') is null
      or not extensions.st_isempty(
        extensions.st_collectionextract(
          extensions.st_makevalid(
            extensions.st_intersection(
              extensions.st_setsrid(extensions.st_geomfromgeojson(rec->>'geom'), 4326),
              extensions.st_setsrid(
                extensions.st_makeenvelope(
                  (rec->>'clipWest')::double precision,
                  (rec->>'clipSouth')::double precision,
                  (rec->>'clipEast')::double precision,
                  (rec->>'clipNorth')::double precision
                ),
                4326
              )
            )
          ),
          3
        )
      )
    )
  on conflict (source_id, external_id) do update
  set
    snapshot_id = excluded.snapshot_id,
    name = excluded.name,
    designation = excluded.designation,
    geom = excluded.geom,
    properties = excluded.properties,
    source_version = excluded.source_version,
    fetched_at = excluded.fetched_at,
    updated_at = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
