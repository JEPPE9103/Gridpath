# NOXHEIM Design Partner Cloud — Operator Runbook

Supervised pilot operations for the hosted Design Partner environment.
Source Health lives in Settings → Data sources. Internal run history lives at `/internal/operations` for allowlisted operator emails only (`OPERATOR_EMAILS`).

## Official sources active

| Source | Slug | Role |
|--------|------|------|
| Ei nätkoncessioner (lokalnät) | `ei-network-area-concessions` | Official local-network geography |
| Ei nätutvecklingsplaner (NUP) | `ei-network-development-plans` | Official planning-area + forecast **transfer-capacity need** |

Semantics remain: **forecast need ≠ available capacity / headroom / connection offer**.

**Noxheim refresh cadence ≠ official source publication cadence.** Schedulers may run daily; each source is due on `refresh_interval_hours` (default 168). Unchanged published content is a successful refresh.

## Normal production ingest (automatic)

GitHub Actions workflow `.github/workflows/official-ingest.yml`:

1. Daily 05:00 UTC (and `workflow_dispatch`)
2. Links the allowlisted cloud project
3. Runs full NUP ingest then full local-network ingest
4. Writes `source_ingestion_runs`, snapshots, versions, diffs, `external_changes`, geographic `change_impacts`, and alerts (NUP only)

Local-network ingest still does **not** create project `external_changes`.

This is the default operating model. Humans are not required when sources are healthy.

## Vercel cron (alerts + email, not full ingest)

- `GET/POST /api/internal/monitor/daily` — workflow-alert reconciliation + important-impact emails
- `GET/POST /api/internal/monitor/weekly` — owner/admin digest (if org has not opted out)

Both require `Authorization: Bearer $CRON_SECRET`. Vercel Cron typically requires a paid plan. `vercel.json` uses daily 06:00 UTC and weekly Monday 07:00 UTC.

Required app env: `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL` (or `INVITE_FROM_EMAIL`).

Sales-demo org (`ea5096a9-8da3-42e6-9dbd-64097414cb03`) is excluded from scheduled email. Owners/admins can disable weekly digest without disabling in-app alerts (Settings → Email notifications).

## Operator fallback (manual)

Use when a run failed, after a source-format change, or to investigate:

```bash
# PowerShell — force full ingest against allowlisted cloud
$env:NOXHEIM_ALLOW_REMOTE_INGEST = "true"
$env:NOXHEIM_REMOTE_PROJECT_REF = "krgzpgqmnzljwlwptmcn"
$env:NOXHEIM_SCHEDULED_INGEST = "true"
$env:INGEST_FORCE = "true"
npm run cloud:ingest-official
```

Or GitHub Actions → Official source ingest → Run workflow → Force.

Individual scripts remain:

```bash
npm run cloud:ingest-ei-nup
npm run cloud:ingest-ei-network-areas
```

## Trusted remote ingest (no secrets in commands)

Default ingest remains **local-only**. Remote requires the dedicated cloud entrypoints (or equivalent env flags).

Allowlisted project ref: `krgzpgqmnzljwlwptmcn`  
Host: `krgzpgqmnzljwlwptmcn.supabase.co`

```bash
# From repo root, with Supabase CLI logged in and project linked
npm run cloud:ingest-ei-network-areas
npm run cloud:ingest-ei-nup
```

Equivalent manual flags (if invoking the core scripts directly):

```bash
# PowerShell
$env:NOXHEIM_ALLOW_REMOTE_INGEST = "true"
$env:NOXHEIM_REMOTE_PROJECT_REF = "krgzpgqmnzljwlwptmcn"
node scripts/ingest-ei-network-areas.mjs
node scripts/ingest-ei-network-development-plans.mjs
```

Safety rules enforced in `scripts/lib/ingest-target.mjs`:

- Without `NOXHEIM_ALLOW_REMOTE_INGEST=true` → localhost only
- Remote ref must match the allowlisted Design Partner Cloud ref
- CLI linked project must match that ref
- Optional `SUPABASE_URL` must match that cloud host
- Never logs credentials

## Sales demo workspace reset

Internal **Northfield Energy Development AB** workspace only (`noxheim-demo-development` / fixed org id). Sample customer data. Does **not** write official grid tables, `external_changes`, or alerts.

```bash
npm run demo:plan
npm run demo:preflight
```

Destructive remote reset (Design Partner Cloud only). Also requires `NOXHEIM_CONFIRM_DEMO_RESET=noxheim-demo-development`:

```bash
npm run demo:reset
```

Equivalent:

```bash
$env:NOXHEIM_ALLOW_REMOTE_DEMO_SEED = "true"
$env:NOXHEIM_REMOTE_PROJECT_REF = "krgzpgqmnzljwlwptmcn"
$env:NOXHEIM_CONFIRM_DEMO_RESET = "noxheim-demo-development"
node --import tsx scripts/seed-sales-demo.mjs
```

Safety:

- Remote off unless `NOXHEIM_ALLOW_REMOTE_DEMO_SEED=true`
- Project ref must be `krgzpgqmnzljwlwptmcn`
- Organization id + slug allowlist only
- Remote reset refused without `NOXHEIM_CONFIRM_DEMO_RESET=noxheim-demo-development`
- Prints demo searches/runs/candidates/opportunities/projects and other-org project counts before delete
- Resets **that org only**; never `db reset`, never `supabase/seed.sql` on cloud
- Discovery leftovers in the demo org are deleted, then Örebro East BESS is re-run as the demo org
- Official GI / cache / `external_changes` / alerts are never written

Demo script: `docs/design-partner-demo.md`  
Cheat sheet: `docs/noxheim-demo-cheat-sheet.md`

## Verify snapshot / completeness

After NUP ingest, the script prints:

- `Normalization completeness: COMPLETE`
- `Result: SUCCESS / COMPLETE`
- expected vs stored observation / version / planning-area counts

Also confirm:

```sql
-- via: npx supabase db query --linked "..."
select slug, authority_level from public.grid_sources order by slug;
select count(*) from public.external_changes;
select count(*) from public.alerts;
select count(*) from public.organizations where name ilike '%NorthGrid%';
select count(*) from public.grid_sources where slug = 'noxheim-local-nup-change-fixture';
```

Expect: two **official** sources; **0** external_changes on baseline; **0** NorthGrid / fixture rows.

## If ingestion fails

1. Do **not** retry against a different Supabase project.
2. Capture the script error output (no secrets).
3. Confirm CLI still linked to `krgzpgqmnzljwlwptmcn`.
4. Re-run the same `cloud:ingest-*` command after fixing network/CLI auth.
5. If NUP completeness is incomplete, treat snapshot as failed — do not tell the customer data is current.

## Auth dashboard (required for hosted signup)

CLI cannot safely inspect/change Cloud Auth. Configure in Supabase Dashboard → Authentication → URL Configuration / Providers → Email:

| Setting | Design Partner Cloud value |
|---------|----------------------------|
| Site URL | `https://www.noxheim.com` |
| Redirect URLs | `https://www.noxheim.com/auth/callback` **and** `https://www.noxheim.com/auth/callback?next=/reset-password` **and** `https://www.noxheim.com/auth/callback?next=/onboarding` **and** `https://www.noxheim.com/**` **and** `https://noxheim.com/**`. Optional transition: `https://gridpath-henna.vercel.app/**`. |
| Enable email signup | ON |
| Confirm email | OFF for tightly supervised pilot smoke (acceptable); if ON, confirmation must land on `/auth/callback?next=/onboarding`. |
| Password recovery template | Use `{{ .ConfirmationURL }}` (not `{{ .SiteURL }}`). |

Password reset is implemented in the app (`/forgot-password` → email → `/auth/callback?next=/reset-password` → `/reset-password`). Recovery sessions must not enter a workspace until the password is updated. SMTP is required for reset emails in production. Do **not** send recovery through Resend product mail.

Do **not** use `.local` emails — GoTrue rejects them as invalid. Use a normal domain for smoke identities.

Do **not** run `supabase config push` from this repo without first changing `site_url` away from localhost — local `config.toml` is for local Stack.

## Absolute prohibitions

- **NEVER** `supabase db reset --linked`
- **NEVER** apply `supabase/seed.sql` to cloud
- **NEVER** run `bootstrap-local-auth`, fixture NUP, or Gävle change-detection scripts against cloud
- **NEVER** put `service_role` in `NEXT_PUBLIC_*` or Vercel client env
- **NEVER** invent capacity / headroom claims in customer communications

## Customer-facing freshness wording

> Official Energimarknadsinspektionen lokalnät and NUP layers in NOXHEIM are maintained by the NOXHEIM team for this pilot. They provide geographic and planning context only. They do not state available grid capacity or guarantee connection feasibility.
