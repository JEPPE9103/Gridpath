# NOXHEIM V1 — production release checklist

Do not skip stop conditions. Do not `db reset --linked`.

## Order

1. **Create backup / check backup availability**  
   Supabase dashboard PITR/backups for `krgzpgqmnzljwlwptmcn` — CONFIGURATION CHECK. See `docs/v1-backup-recovery.md`.
2. **Configure required secrets**  
   App (Vercel): see `.env.example`. GitHub Actions: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`. Optional: `OPERATOR_EMAILS`, `SENTRY_DSN`.
3. **Apply migrations**  
   Exact order in `docs/v1-migration-runbook.md`. Stop on first error.
4. **Verify Storage bucket/policies**  
   Bucket `project-documents` exists; signed download works for a member; other org denied.
5. **Run database smoke queries**  
   `list_source_health`, ingest run functions, PostGIS, notification settings table.
6. **Deploy app**  
   After migrations, not before functions the app calls.
7. **Verify scheduler**  
   Vercel crons: `/api/internal/monitor/daily` and `/weekly` with `CRON_SECRET`.  
   GitHub workflow `Official source ingest` enabled on `main` (or the release branch).
8. **Run first full official ingest**  
   GitHub Actions workflow_dispatch with force, or operator fallback script. Confirm completeness logs.
9. **Verify source health**  
   Settings → Data sources shows last successful full ingest, not a probe-only leftover as “healthy forever”.
10. **Test two-org RLS isolation**  
    Project rows, alerts, documents metadata.
11. **Test document Storage isolation**  
    Signed URL from org A must not read org B paths.
12. **Test invite email**  
    Owner/admin invite; copy-link still works if provider fails.
13. **Test important alert email**  
    Only for geographically matched published change; demo org must not receive it.
14. **Test weekly digest in controlled mode**  
    Owner/admin; opt-out via Settings → Email notifications; demo org skipped.
15. **Test imported project GI**  
    Official match where coordinates intersect; no invented official GI.
16. **Test archive/restore**  
    Hidden from default portfolio; restore returns it; alerts reconcile.
17. **Test saved Compare**  
    Shared with workspace; temporary browser compare still separate.
18. **Test change review**  
    Review/dismiss alerts; `/changes` honest copy.
19. **Confirm demo tenant safety**  
    Sample banner; no product email; official GI still official datasets.
20. **Invite first design partner**  
    Real signup → empty tenant. Do not seed sales-demo data into their org.

## Rollback / stop conditions

Stop and do not invite customers if:

- Migrations did not apply cleanly
- Full ingest failed and there is no last-known-good snapshot
- RLS isolation test fails
- Storage isolation test fails
- Cron endpoints are reachable without `CRON_SECRET`
- Demo org sends product email
- CSP or headers break login, map, or Supabase auth

Rollback options (choose the least destructive that restores integrity):

- Revert the app deploy to the previous Vercel deployment
- Restore database via Supabase PITR if a migration corrupted data (**platform check**)
- Disable GitHub ingest workflow and Vercel crons until fixed
- Do **not** `db reset --linked`

## After go-live

Normal MONITOR path: GitHub scheduled worker → full ingest → snapshot/diff/impacts/alerts. Vercel daily cron reconciles workflow alerts and sends eligible emails. Humans are not part of the healthy path.
