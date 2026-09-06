-- Private Noxheim transport cache for official public Ei artifacts.
-- This is not customer storage and is not the authoritative source.
-- Provenance remains Energimarknadsinspektionen (Ei).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'official-source-cache',
  'official-source-cache',
  false,
  52428800,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/octet-stream',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.official_source_artifacts (
  id uuid primary key default gen_random_uuid(),
  source_slug text not null,
  source_kind text not null,
  official_source_url text not null,
  discovery_page_url text not null,
  fetched_at timestamptz not null default now(),
  content_sha256 text not null,
  byte_size integer not null,
  content_type text,
  original_filename text,
  storage_path text not null,
  processing_status text not null default 'cached',
  processed_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  constraint official_source_artifacts_kind_check
    check (source_kind in ('xlsx', 'zip')),
  constraint official_source_artifacts_status_check
    check (processing_status in ('cached', 'processed', 'failed')),
  constraint official_source_artifacts_sha_check
    check (content_sha256 ~ '^[a-f0-9]{64}$'),
  constraint official_source_artifacts_size_check
    check (byte_size > 0),
  constraint official_source_artifacts_path_check
    check (storage_path ~ '^ei/[a-z0-9-]+/[a-f0-9]{64}\.(xlsx|zip)$'),
  constraint official_source_artifacts_slug_check
    check (source_slug in ('ei-network-development-plans', 'ei-network-area-concessions')),
  constraint official_source_artifacts_unique_hash
    unique (source_slug, content_sha256)
);

comment on table public.official_source_artifacts is
  'Noxheim transport cache metadata for official public Ei files. Ei remains the official source; this table is not a publisher.';

comment on column public.official_source_artifacts.official_source_url is
  'Original official Ei HTTPS URL. Never a Supabase or cache URL.';

comment on column public.official_source_artifacts.storage_path is
  'Private Storage object path used only as transport. Not shown as the official source.';

alter table public.official_source_artifacts enable row level security;
alter table public.official_source_artifacts force row level security;

revoke all on table public.official_source_artifacts from anon, authenticated;
grant select, insert, update on table public.official_source_artifacts to service_role;

drop policy if exists official_source_artifacts_service_role on public.official_source_artifacts;
create policy official_source_artifacts_service_role
  on public.official_source_artifacts
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists official_source_artifacts_slug_fetched_idx
  on public.official_source_artifacts (source_slug, fetched_at desc);

-- No storage.objects policies for this bucket: customers cannot list or download.
-- service_role (Vercel fetch + GitHub ingest) bypasses RLS.
