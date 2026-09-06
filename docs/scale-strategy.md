# Portfolio scale strategy

PostgREST is configured with `max_rows = 1000` in `supabase/config.toml`. NOXHEIM does not raise that cap. Organisation-wide reads that can exceed 1,000 rows must page, chunk, or aggregate in SQL.

## Queries

| Surface | Strategy |
| --- | --- |
| Portfolio table | Server pagination (`range`, 50 rows). Exact `count` for matching totals. Header active count / MW come from `get_organization_project_aggregates`, not the current page. |
| Overview KPIs | SQL aggregate RPC. Active sites, active MW, enquiry count and open grid studies are computed for the whole organisation. Archived projects are excluded from those KPIs by default. |
| Overview attention / pipeline | Paged reads of active project meta, cases, requirements and alerts until a short page is returned. Attention is derived from the complete active set. |
| Map | Paged active projects with primary-site geometry and map fields only. Related cases/requirements/alerts are fetched with `.in()` chunks of 200 ids. |
| Reports | Same paged active-project reads as overview. Summary project count and MW come from the aggregate RPC. |
| Connections / documents | Paged inner joins on `projects` with `archived_at is null`. Document project pickers list active projects only. |
| Changes | Paged `change_impacts` plus chunked lookups. Historical impacts remain visible even if the project is later archived. |
| Import duplicate check | Paged `id, name, primary site geom` for the organisation. |

## Indexes

Added for these query shapes:

- `(organization_id, updated_at desc)` and partial active/archived variants for portfolio lists
- `(organization_id, lower(name))` for duplicate-name checks and search

## Safety cap

`fetchAllQueryPages` stops at 100,000 rows. That is a runaway-query guard, not a product limit. If it is hit, the caller logs/returns an error rather than silently truncating at 1,000.
