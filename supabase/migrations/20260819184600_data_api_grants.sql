-- Explicit Data API grants for the authenticated role.
-- Table privileges only allow the role to attempt the operation; existing RLS
-- policies remain the authorization layer for which rows are visible or writable.
-- Do not grant customer tables to anon. Do not grant private-schema tables.

grant select
on table public.grid_operators
to authenticated;

grant select, update, delete
on table public.organizations
to authenticated;

grant select, insert, update
on table public.profiles
to authenticated;

grant select, insert, update, delete
on table public.organization_members
to authenticated;

grant select, insert, update, delete
on table public.projects
to authenticated;

grant select, insert, update, delete
on table public.project_sites
to authenticated;

grant select, insert, update, delete
on table public.connection_cases
to authenticated;

grant select, insert, update, delete
on table public.project_requirements
to authenticated;

grant select, insert, update, delete
on table public.documents
to authenticated;

grant select, insert, update, delete
on table public.project_events
to authenticated;

grant select, insert, update, delete
on table public.alerts
to authenticated;

-- Workspace creation stays on create_workspace(); no INSERT grant on organizations.
revoke all on function public.create_workspace(text, text, text, text) from public;
revoke all on function public.create_workspace(text, text, text, text) from anon;
grant execute on function public.create_workspace(text, text, text, text) to authenticated;
