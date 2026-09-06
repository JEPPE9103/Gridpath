# NOXHEIM V1 — backup and recovery

These are operator procedures. Do not claim platform capabilities that have not been verified in the target project.

## Supabase backups

**CONFIGURATION / PLATFORM CHECK** — not verified from this repository.

Before first production apply/deploy, confirm in the Supabase dashboard for project `krgzpgqmnzljwlwptmcn`:

- Point-in-time recovery / daily backups are enabled for the plan
- Who can restore
- Retention window

This repo does not perform database dumps.

## A. Official ingest fails

Expected: previous successful snapshot and observations remain. Failed runs are recorded with a sanitized `error_code`. Cadence retries after failure.

Operator fallback (not the normal path):

```bash
$env:NOXHEIM_ALLOW_REMOTE_INGEST = "true"
$env:NOXHEIM_REMOTE_PROJECT_REF = "krgzpgqmnzljwlwptmcn"
$env:NOXHEIM_SCHEDULED_INGEST = "true"
$env:INGEST_FORCE = "true"
node scripts/scheduled-official-ingest.mjs
```

Or GitHub Actions → Official source ingest → Run workflow → Force.

Do not delete last-known-good official data because a fetch failed.

## B. Email provider fails

Invite still creates a copyable link. Impact/digest rows stay `failed` with a reason. In-app alerts are unchanged. Retry happens on the next daily/weekly cron. Check `/internal/operations` (operator allowlist) for failed deliveries.

## C. Storage object write succeeds but DB write fails

Upload path: insert document row → upload object → update metadata. If metadata update fails, the code attempts to remove the orphan object. If cleanup also fails, an operator may see an unreferenced object under `project-documents/{organization_id}/...`. Do not bulk-delete Storage without matching `documents.storage_path`.

## D. Migration partially fails

Stop. Do not apply later files. Use the platform backup/PITR if available. Record the last successful statement from the CLI output. See `docs/v1-migration-runbook.md`.

## E. Bad official source format

Ingest classifies parse/xlsx/shapefile errors as non-retryable `source_format`. Last good snapshot remains. Fix the parser or wait for a corrected official file, then force a manual ingest.

## F. Scheduler misses a run

GitHub Actions daily check uses due/change logic (`refresh_interval_hours`, default 168). A missed day is not an emergency if the last full ingest is still inside 2× cadence (source health “stale” only after that). Re-run the workflow manually if a publication was missed.

Vercel daily cron does **not** run full ingest; if it misses, workflow alerts and impact emails may lag until the next successful invocation.

## G. Customer deletes or archives unexpectedly

Archive hides the project from default portfolio/map and resolves open alerts for that project on the next reconcile. Restore is a first-class action. Hard delete of a project is destructive within the tenant; official GI is not deleted. Documents: deleting a document removes the Storage object when authorized.

## Demo tenant

Sales demo org emails are disabled in SQL/jobs. `npm run demo:reset` is allowlisted to that org only and must not be used as a backup tool for customer tenants.
