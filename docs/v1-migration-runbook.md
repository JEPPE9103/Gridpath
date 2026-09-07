# NOXHEIM V1 — migration runbook

Do **not** apply these to the linked Design Partner Cloud until the release checklist says so.
Do **not** `db reset --linked`.

## Unapplied V1 chain (exact order)

Apply only with `npx supabase db push` against the intended target after a backup check.

1. `supabase/migrations/20260904190000_v1_integrity_membership_snapshots.sql`
2. `supabase/migrations/20260904200000_v1_archive_import_scale.sql`
3. `supabase/migrations/20260905100000_v1_documents_team_compare.sql`  
   Creates Storage bucket `project-documents` and document/compare objects.
4. `supabase/migrations/20260906100000_v1_monitor_alerts_notifications.sql`  
   Ingestion runs, alerts workflow, notification prefs/deliveries, monitor RPCs.
5. `supabase/migrations/20260907100000_v1_release_candidate.sql`  
   Full-ingest cadence (ignore probe-only), richer `list_source_health`, column grant on run `error_message`.
6. `supabase/migrations/20260907200000_official_source_cache.sql`  
   Private official-source transport cache (not customer storage).
7. `supabase/migrations/20260907220000_fix_team_members_email_type.sql`  
   Cast `auth.users.email` to `text` in `list_organization_team_members` (RETURN QUERY 42804).
8. `supabase/migrations/20260907230000_official_map_layers.sql`  
   Simplified official GeoJSON RPCs for the portfolio map (covering + spatial matches). No new geometry tables.
10. `supabase/migrations/20260907250000_official_change_impact_review.sql`  
    Optional `change_impacts.review_note`, org-scoped `review_organization_change_impact`, milder change-impact alerts, review-status index. Does not alter immutable `external_changes`.

Earlier migrations (`20260819*`–`20260901*`) are assumed already applied on cloud.

## Audit notes (RC)

| Risk | Finding |
| --- | --- |
| Ordering | RC migration replaces `private.begin_source_ingestion_run` and drops/recreates `public.list_source_health()`. It must follow `20260906100000`. |
| Duplicate objects | No second `source_ingestion_runs` table. RC only replaces functions + grants + indexes. |
| Policies | Document/compare/monitor policies live in 051 and 061. RC does not recreate them. |
| Function replacement | `DROP FUNCTION public.list_source_health()` is required because the return type grows. |
| NOT NULL | No new NOT NULL on existing populated customer tables. |
| Storage | Bucket `project-documents` is created in 051. Re-running 051 is not idempotent for `insert into storage.buckets` — apply once. |
| Grants | RC revokes table-level `SELECT` on `source_ingestion_runs` from `authenticated` and re-grants columns except `error_message`. Service role keeps full access. |
| Backfill | Notification prefs: missing row = both emails enabled. No backfill required. Probe-only historic runs remain; cadence now ignores them. |

## Verification after apply (read-only)

```sql
select to_regprocedure('public.list_source_health()');
select to_regprocedure('private.begin_source_ingestion_run(text,text)');
select id from storage.buckets where id = 'project-documents';
select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'source_ingestion_runs'
  order by ordinal_position;
```

Then, as an authenticated test user in a scratch org (not production data):

- Upload a tiny project document and download via signed URL.
- Confirm a second org cannot read the object path.
- Confirm `list_source_health` returns the two official slugs.

## Stop conditions

Stop applying if:

- `db push` reports a duplicate policy/function and the object already exists with a different body.
- Storage bucket insert fails because the bucket exists **and** policies are missing — inspect before inventing a fix.
- Any statement errors after a partial apply — do not continue. Restore from backup / Supabase point-in-time if available (see `docs/v1-backup-recovery.md`).
