# NOXHEIM Design Partner Cloud — Operator Runbook

Supervised pilot operations for the hosted Design Partner environment.
This is **not** a full production worker or source-health UI.

## Official sources active

| Source | Slug | Role |
|--------|------|------|
| Ei nätkoncessioner (lokalnät) | `ei-network-area-concessions` | Official local-network geography |
| Ei nätutvecklingsplaner (NUP) | `ei-network-development-plans` | Official planning-area + forecast **transfer-capacity need** |

Semantics remain: **forecast need ≠ available capacity / headroom / connection offer**.

## Manual refresh cadence

For the first design-partner pilot:

- **Baseline**: already loaded into Design Partner Cloud during go-live.
- **Re-check**: weekly, or after known Ei publication updates.
- **NUP change detection**: only when a **new** workbook content hash is ingested after a successful baseline.

Tell customers: “Official Grid Intelligence was last refreshed on \<date\> by NOXHEIM operations.”

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
| Site URL | `https://www.noxheim.com` (canonical). Keep `https://gridpath-henna.vercel.app` as an allowed Redirect URL during transition. |
| Redirect URLs | `https://www.noxheim.com/**`, `https://noxheim.com/**`, and optionally `https://gridpath-henna.vercel.app/**` |
| Enable email signup | ON |
| Confirm email | OFF for tightly supervised pilot smoke (acceptable); if ON, SMTP must work before relying on signup |
| Minimum password length | ≥ 8 (app validates 8+) |

Password reset is not implemented in the app UI yet — treat as a known pilot limitation (operator-assisted reset via Supabase Dashboard if needed).

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
