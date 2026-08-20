-- Workflow fields discovered during Project Detail.
-- Existing requirement rows become required = true and category = other via defaults.
-- RLS policies are unchanged.

alter table public.project_requirements
  add column required boolean not null default true,
  add column category text not null default 'other',
  add column due_date date;

alter table public.project_requirements
  add constraint project_requirements_category_check
  check (
    category in (
      'technical',
      'land',
      'permit',
      'grid',
      'commercial',
      'environmental',
      'other'
    )
  );

alter table public.connection_cases
  add column notes text;
