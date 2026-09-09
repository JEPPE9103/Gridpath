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

Tenant relationship: `organization_members` joins a profile to an organization. Projects, alerts, `change_impacts`, and development opportunities are organization-scoped via `organization_id`.

Membership **writes** (insert/update/delete) are not granted to `authenticated`. Use RPCs: `create_workspace`, invite/accept/revoke, `change_organization_member_role`, `remove_organization_member`, `leave_organization`.

Active workspace is an application cookie, not a database column. RLS remains membership-based.

## Projects

| Table | Important columns |
| --- | --- |
| `projects` | `organization_id`, `grid_operator_id`, `name`, `slug`, `location` (text), `region`, `technology`, `import_mw`, `export_mw`, `voltage_level`, `connection_stage`, `connection_outlook`, `confidence`, `target_cod`, `description`, `archived_at`, `archived_by`, `originating_opportunity_id` |
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

## Development Intelligence

Opportunities exist before projects. They are org-scoped. NOXHEIM does **not** estimate available grid capacity from these tables.

| Table | Important columns |
| --- | --- |
| `opportunity_searches` | `organization_id`, `created_by`, screening criteria, bbox, `screening_profile_id`, `slope_mode`, `max_slope_degrees`, `land_cover_rules`, `max_road_distance_m`, `road_mode`, development-assumption notes |
| `opportunity_screening_profiles` | org-scoped reusable profiles (`origin` `noxheim_default` \| `customer`) |
| `opportunity_search_runs` | criteria snapshot, source versions, provider availability, ranking/methodology versions, evaluated/excluded/returned counts, `change_summary`, `previous_run_id` |
| `opportunity_run_candidates` | contiguous candidate-area geometry (not parcels), exclusion breakdown, slope/land-cover/road metrics, recommendation, `screening` jsonb |
| `development_opportunities` | plus originating run/candidate, `area_geom`, usable/gross/contiguous ha, `screening_snapshot`, `exclusion_breakdown` |
| `official_geographic_features` | global official polygons (`protected_area`, `natura_2000`) |
| `official_physical_summaries` | 1 km `terrain` / `land_cover` summaries, GIST |
| `official_transport_features` | official road centre-lines |
| `opportunity_assessments` | per-dimension explainable result, `source_kind` (`customer_data` \| `official` \| `noxheim_derived`), `completeness`, `evidence` |
| `opportunity_events` | decision/history records |

Statuses: `identified`, `screening`, `strong_candidate`, `under_review`, `shortlisted`, `promoted`, `rejected`.

Recommendations: `prioritise`, `investigate`, `secondary`, `low_priority`, `insufficient_evidence`.

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
| `change_impacts` | `external_change_id`, `organization_id`, `project_id`, `match_type`, `impact_level`, `review_status` (`unreviewed` \| `confirmed` \| `dismissed`), `reviewed_by`, `reviewed_at`, `review_note` — org must match project org (trigger); review is org/project scoped and does not mutate `external_changes` |

Official Ei source slugs: `ei-network-area-concessions`, `ei-network-development-plans`.
Naturvårdsverket slugs: `nv-protected-areas`, `nv-natura-2000`, `nv-nmd-2023`, `nv-nmd-2018` (legacy).
Copernicus slug: `copernicus-dem-glo90`. Trafikverket slug: `trafikverket-inspire-roadlink`.
SCB slug: `scb-administrative-areas`. Lantmäteriet DTM slug: `lantmateriet-dtm-1m` (AUTH_REQUIRED until Geotorget).
SvK slug: `svk-indicative-transmission-2026` (blocked; no structured source).

`official_precision_summaries` holds 100 m land-cover / detailed terrain tiles for refinement only.
`opportunity_run_candidates` now includes `screening_stage`, `refinement_status`, discovery vs detailed ranks, and evidence-resolution labels.
`opportunity_assessment_versions` stores assessment history; `opportunity_reassessment_notices` flags saved opportunities when an official source version changes.

NUP numeric values are forecast transfer-capacity **need**, never available capacity / headroom / connection capacity.

## RPCs (authenticated unless noted)

- `public.create_workspace(company_name, company_slug, user_full_name, user_job_title)` — onboarding (`src/lib/auth/actions.ts`)
- `public.create_project_with_primary_site(...)` / `public.update_project_with_primary_site(...)` — portfolio CRUD (optional `description`, `region`, `voltage_level`)
- `public.create_development_opportunity(...)` / `public.promote_opportunity_to_project(p_opportunity_id)` / `public.allocate_opportunity_slug(...)`
- `public.execute_opportunity_screening_run(p_search_id)` / `public.apply_opportunity_run_assessments(p_run_id, p_rows)` / `public.refine_opportunity_run_candidates(p_run_id, p_candidate_ids)` / `public.save_opportunity_from_run_candidate(p_candidate_id)` / `public.get_opportunity_run_geojson(p_run_id)` — org-scoped contiguous candidate areas; covering is not capacity; refine is max 5 candidates
- `public.get_official_covering_summary_for_point(p_latitude, p_longitude)` — covering Ei local-network + NUP names at a point; not capacity
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
- `public.review_organization_change_impact(p_impact_id, p_status, p_note)` — org-scoped confirm/dismiss of a change impact; resolves matching open alerts; does not mutate `external_changes`
- `public.list_source_health()` — authenticated source-health view (no raw payloads)
- Service-role only: `monitor_begin_source_run`, `monitor_complete_source_run`, `monitor_reconcile_workflow_alerts`, `monitor_list_undelivered_impact_emails`, `monitor_list_weekly_digests`, `monitor_claim_notification_delivery`, `monitor_finish_notification_delivery`
