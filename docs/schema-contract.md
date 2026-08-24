# Noxheim schema contract

Canonical identifiers for the local reconstructible schema. Application queries, seed, RPCs, and migrations must use these names. Do not invent aliases.

## Tenant

| Table | Important columns |
| --- | --- |
| `organizations` | `id`, `name`, `slug` |
| `profiles` | `id` (auth user), `full_name`, `job_title` |
| `organization_members` | `organization_id`, `profile_id`, `role` (`owner` \| `admin` \| `member` \| `viewer`) |
| `grid_operators` | `id`, `name`, `country_code` |

Tenant relationship: `organization_members` joins a profile to an organization. Projects, alerts, and `change_impacts` are organization-scoped via `organization_id`.

## Projects

| Table | Important columns |
| --- | --- |
| `projects` | `organization_id`, `grid_operator_id`, `name`, `slug`, `location` (human-readable text), `region`, `technology`, `import_mw`, `export_mw`, `voltage_level`, `connection_stage`, `connection_outlook`, `confidence`, `target_cod` |
| `project_sites` | `project_id`, `name`, `location` (optional text), `geom` (`geometry(Point, 4326)`), `is_primary` |
| `connection_cases` | `project_id`, `grid_operator_id`, `case_id`, `stage`, `status`, `submitted_at`, `next_milestone`, `deadline`, `notes` |
| `project_requirements` | `project_id`, `connection_case_id`, `label`, `status`, `required`, `category`, `due_date` |
| `documents` | `project_id`, `name`, `category`, `status`, `owner_id` |
| `project_events` | `project_id`, `title`, `detail`, `source`, `occurred_at` |
| `alerts` | `organization_id`, `project_id`, `severity`, `status`, `title`, `summary`, `detail`, `cta_label`, `href`, `metadata` |

Geometry: project coordinates live on `project_sites.geom`, not `projects.location`. Primary site is `project_sites.is_primary` (one primary per project).

## Grid Intelligence

| Table | Important columns |
| --- | --- |
| `grid_sources` | `name`, `slug`, `source_type`, `publisher`, `base_url`, `active`, `authority_level` |
| `grid_areas` | `source_id`, `external_id`, `name`, `area_type`, `geometry` (`MultiPolygon`, 4326), `country_code` |
| `source_snapshots` | `source_id`, `content_hash`, `raw_content`, `storage_path`, `status` |
| `grid_observations` | `source_id`, `grid_area_id`, `external_id`, `observation_type`, `value_numeric`, `raw_metadata` |
| `grid_observation_versions` | versioned copies of observations for change detection |
| `external_changes` | `source_id`, snapshot ids, `change_type`, `observation_external_id` |
| `change_impacts` | `external_change_id`, `organization_id`, `project_id`, `match_type`, `impact_level`, `review_status` |

Official Ei source slugs: `ei-network-area-concessions`, `ei-network-development-plans`.

NUP numeric values are forecast transfer-capacity **need**, never available capacity / headroom / connection capacity.

## RPCs

- `public.create_workspace(company_name, company_slug, user_full_name, user_job_title)` — authenticated onboarding; not used by current pages
- `public.get_official_grid_area_context_for_project(p_project_id)` — Ei concession / local-network match
- `public.get_official_network_development_plan_context_for_project(p_project_id)` — Ei NUP planning-area match
