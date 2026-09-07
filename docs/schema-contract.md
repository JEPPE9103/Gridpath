# Noxheim schema contract

Canonical identifiers for the reconstructible schema. Application queries, seed, RPCs, and migrations must use these names.

## Tenant

| Table | Important columns |
| --- | --- |
| `organizations` | `id`, `name`, `slug` |
| `profiles` | `id` (auth user), `full_name`, `job_title` |
| `organization_members` | `organization_id`, `profile_id`, `role` (`owner` \| `admin` \| `member` \| `viewer`) |
| `organization_invites` | `organization_id`, `email`, `role`, `token_hash`, `status`, `expires_at` |
| `grid_operators` | `id`, `name`, `country_code` |
| `demo_requests` | marketing leads; authenticated/anon **INSERT only** (no client SELECT) |

Tenant relationship: `organization_members` joins a profile to an organization. Projects, alerts, and `change_impacts` are organization-scoped via `organization_id`.

Membership **writes** (insert/update/delete) are not granted to `authenticated`. Use RPCs: `create_workspace`, invite/accept/revoke, `change_organization_member_role`, `remove_organization_member`, `leave_organization`.

Active workspace is an application cookie, not a database column. RLS remains membership-based.

## Projects

| Table | Important columns |
| --- | --- |
| `projects` | `organization_id`, `grid_operator_id`, `name`, `slug`, `location` (text), `region`, `technology`, `import_mw`, `export_mw`, `voltage_level`, `connection_stage`, `connection_outlook`, `confidence`, `target_cod`, `description`, `archived_at`, `archived_by` |
| `project_sites` | `project_id`, `name`, `location`, `geom` (`geometry(Point, 4326)`), `is_primary` |
| `connection_cases` | `project_id`, `grid_operator_id`, `case_id`, `stage`, `status`, `submitted_at`, `next_milestone`, `deadline`, `notes` |
| `project_requirements` | `project_id`, `connection_case_id`, `label`, `status`, `required`, `category`, `due_date` — case must belong to the same project (trigger) |
| `documents` | `project_id`, `name`, `category`, `status`, `owner_id`, `storage_path`, `original_filename`, `mime_type`, `file_size_bytes`, `uploaded_by`, `uploaded_at` — customer-provided files in private Storage bucket `project-documents`; `storage_path` null = legacy metadata-only row |
| `portfolio_comparisons` | `organization_id`, `name`, `created_by` — shared named Development Profile comparisons |
| `portfolio_comparison_projects` | `comparison_id`, `project_id`, `sort_order` — max 4; project org must match comparison org; archived projects cannot be newly inserted |
| `project_events` | `project_id`, `title`, `detail`, `source`, `occurred_at` |
| `portfolio_imports` | `organization_id`, `created_by`, `filename`, `success_count`, `skipped_count`, `failed_count`, `added_mw`, `official_match_count` — bulk import history; client SELECT only |
| `alerts` | `organization_id`, `project_id`, `severity`, `status` (`open` \| `dismissed` \| `resolved`), `alert_type`, `natural_key`, `title`, `summary`, `detail`, `cta_label`, `href`, `metadata` — project org must match (trigger) |
| `organization_notification_settings` | `digest_enabled`, `impact_email_enabled` — missing row means both enabled; sales-demo org is never emailed |
| `notification_deliveries` | `kind` (`impact_email` \| `weekly_digest`), `status` (`attempted` \| `accepted` \| `failed`), `period_key` — no bodies, recipients, or API keys |

Geometry: coordinates live on `project_sites.geom`. Primary site is `project_sites.is_primary` (one primary per project).

## Grid Intelligence

| Table | Important columns |
| --- | --- |
| `grid_sources` | `name`, `slug`, `source_type`, `publisher`, `base_url`, `active`, `authority_level`, `refresh_interval_hours` (NOXHEIM check cadence) |
| `source_ingestion_runs` | operational refresh history: `status` (`running` \| `success` \| `failed` \| `skipped`), `trigger_type` (`manual` \| `scheduled`), counts, sanitized `error_code`/`error_message` — no credentials or raw payloads |
| `grid_areas` | `source_id`, `external_id`, `name`, `area_type`, `geometry` (`MultiPolygon`, 4326), `country_code` |
| `source_snapshots` | `source_id`, `content_hash`, `raw_content` (not selectable by authenticated clients), `storage_path`, `status`, `retrieved_at` |
| `grid_observations` | `source_id`, `grid_area_id`, `external_id`, `observation_type`, `value_numeric`, `raw_metadata` |
| `grid_observation_versions` | versioned copies for change detection |
| `external_changes` | `source_id`, snapshot ids, `change_type`, `observation_external_id` |
| `change_impacts` | `external_change_id`, `organization_id`, `project_id`, `match_type`, `impact_level`, `review_status` — org must match project org (trigger) |

Official Ei source slugs: `ei-network-area-concessions`, `ei-network-development-plans`.

NUP numeric values are forecast transfer-capacity **need**, never available capacity / headroom / connection capacity.

## RPCs (authenticated unless noted)

- `public.create_workspace(company_name, company_slug, user_full_name, user_job_title)` — onboarding (`src/lib/auth/actions.ts`)
- `public.create_project_with_primary_site(...)` / `public.update_project_with_primary_site(...)` — portfolio CRUD (optional `description`, `region`, `voltage_level`)
- `public.archive_project(p_project_id)` / `public.restore_project(p_project_id)`
- `public.get_organization_project_aggregates(p_organization_id, p_include_archived)`
- `public.import_organization_projects(p_organization_id, p_filename, p_rows, p_skipped_count)`
- `public.primary_site_coordinates(p_project_id)`
- `public.get_official_grid_area_context_for_project(p_project_id)`
- `public.get_official_network_development_plan_context_for_project(p_project_id)`
- `public.get_official_map_layer_geojson(p_layer, p_west, p_south, p_east, p_north, p_zoom)` — simplified official GeoJSON for the portfolio map (`local_network` \| `planning_area`); no raw snapshots
- `public.get_official_covering_geojson_for_project(p_project_id)` — org-scoped covering polygons
- `public.get_organization_official_spatial_matches(p_organization_id)` — active-project covering ids (LATERAL covering, not jsonb ORDER BY)
- `public.get_official_map_area_context(p_area_id, p_organization_id)` — polygon inspector; `projectCount` only when caller belongs to the org
- Team: `list_organization_team_members` (casts `auth.users.email` to `text` for RETURN QUERY), `list_organization_pending_invites`, `create_organization_invite`, `resend_organization_invite`, `revoke_organization_invite`, `accept_organization_invite`, `change_organization_member_role`, `remove_organization_member`, `leave_organization`
- `public.get_organization_invite_preview(p_token_hash)` — authenticated + anon (token is the secret)
- `public.list_source_health()` — authenticated source-health view (no raw payloads)
- Service-role only: `monitor_begin_source_run`, `monitor_complete_source_run`, `monitor_reconcile_workflow_alerts`, `monitor_list_undelivered_impact_emails`, `monitor_list_weekly_digests`, `monitor_claim_notification_delivery`, `monitor_finish_notification_delivery`
