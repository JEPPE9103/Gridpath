-- Demo requests from the marketing site (insert-only for visitors).

create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text not null,
  email text not null,
  message text,
  created_at timestamptz not null default now(),
  constraint demo_requests_name_not_blank check (char_length(trim(name)) > 0),
  constraint demo_requests_company_not_blank check (char_length(trim(company)) > 0),
  constraint demo_requests_email_not_blank check (char_length(trim(email)) > 0)
);

alter table public.demo_requests enable row level security;
alter table public.demo_requests force row level security;

create policy demo_requests_insert_public
  on public.demo_requests
  for insert
  to anon, authenticated
  with check (
    char_length(trim(name)) between 1 and 120
    and char_length(trim(company)) between 1 and 120
    and char_length(trim(email)) between 3 and 254
    and (message is null or char_length(message) <= 2000)
  );

grant insert on table public.demo_requests to anon, authenticated;

revoke all on table public.demo_requests from anon, authenticated;
grant insert on table public.demo_requests to anon, authenticated;
