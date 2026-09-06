# NOXHEIM

B2B Grid Development Intelligence for BESS, renewable and other grid-dependent development teams.

NOXHEIM is a multi-tenant workspace: **Screen** (portfolio + map + compare), **Manage** (projects, connection cases, requirements, project documents), **Monitor** (official source snapshots and geographic change impacts).

It does **not** guarantee grid capacity. Distinguish:

- **Customer entered** — projects, outlook, confidence, cases, requirements, uploaded documents
- **Official source** — Energimarknadsinspektionen (Ei) local-network geography and NUP forecast **need for transfer capacity** (not available connection MW)
- **NOXHEIM derived** — readiness %, Development Profile triage, attention, geographic matching

## Tech stack

- Next.js 16 (App Router)
- TypeScript, React 19, Tailwind CSS 4
- Supabase (Postgres 17, PostGIS, Auth, RLS)
- MapLibre GL, Recharts

Live product data path: `src/features/*` → `src/lib/data/*` and server actions → Supabase with RLS. There is no in-app mock repository layer.

## Local development

Against **local** Supabase only. Do not `db reset --linked` or apply `supabase/seed.sql` to cloud.

```bash
npx supabase start
npx supabase db reset
npm run dev:bootstrap-auth
npm run dev
```

`npm run dev:bootstrap-auth` recreates the local login. It talks only to `http://127.0.0.1:54321` (or localhost).

Local seed login (from `supabase/seed.sql` + bootstrap, not production):

- Email: `anna@noxheim-demo.local`
- Password: `NoxheimDemo2026!`
- Organization: NorthGrid Development AB (owner)

Hosted app: [https://www.noxheim.com](https://www.noxheim.com) — sign up creates an **empty** workspace. Sales demo data is a separate internal org (`noxheim-demo-development`).

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test:intelligence
npm run test:tenancy
npm run test:team
```

## Auth and workspaces

- Sign up / sign in / forgot password / reset password are implemented (`src/lib/auth/actions.ts`).
- `create_workspace` RPC creates the first organization (owner).
- Team invites and roles: Settings → team RPCs (`organization_invites`). Copy invite link is always available. Invitation email sends only when `RESEND_API_KEY` and `INVITE_FROM_EMAIL` are configured; otherwise the UI reports configuration required and does not claim email was sent.
- Active workspace: httpOnly cookie, membership-validated (`src/lib/organization/active-org-resolve.ts`).
- Membership row writes are RPC-only (not direct PostgREST).

## Project structure

```
src/app/              App Router (marketing, auth, workspace)
src/components/       Shared UI
src/features/         Page views
src/lib/data/         Supabase loaders (organization-scoped)
src/lib/*/actions.ts  Server mutations
src/lib/intelligence/ Attention, briefs, compare copy
src/lib/domain/       Readiness, development profile, GI types
supabase/migrations/  Schema, RLS, RPCs
scripts/              Ei ingest, sales-demo reset (guarded)
docs/                 Demo, ops, schema, attention model
```

## Official Grid Intelligence

Normal production path is **automatic full ingest** via GitHub Actions (`.github/workflows/official-ingest.yml`): snapshot → normalize → versions → diff → external changes → geographic impacts → alerts.

Noxheim’s check cadence (default every 168 hours per source, with a daily scheduler that skips when not due) is **not** Ei’s publication cadence.

Vercel cron (`/api/internal/monitor/daily` and `/weekly`) reconciles workflow alerts and sends eligible emails. It does **not** run Excel/shapefile ingest.

Operator fallback (local/debug/disaster recovery only):

```bash
npm run cloud:ingest-ei-network-areas
npm run cloud:ingest-ei-nup
```

Or force the same worker GitHub uses:

```bash
$env:NOXHEIM_ALLOW_REMOTE_INGEST = "true"
$env:NOXHEIM_REMOTE_PROJECT_REF = "krgzpgqmnzljwlwptmcn"
$env:NOXHEIM_SCHEDULED_INGEST = "true"
$env:INGEST_FORCE = "true"
npm run cloud:ingest-official
```

See `docs/design-partner-operations.md`, `docs/v1-release-checklist.md`, and `.env.example`. NUP numeric values are forecast transfer-capacity **need**, never available MW.

Monitor is **not active in production until deployed and configured**. Required env:

- `CRON_SECRET` — Vercel Cron `Authorization: Bearer` (and/or `x-cron-secret`)
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; never `NEXT_PUBLIC_*`
- `RESEND_API_KEY`
- `NOTIFICATION_FROM_EMAIL` (falls back to `INVITE_FROM_EMAIL` if unset)
- GitHub Actions secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` for full ingest

`vercel.json` defines daily (`0 6 * * *`) and weekly Monday (`0 7 * * 1`) crons. Vercel Cron availability is plan-dependent.

Sales-demo organisation emails are disabled.

## Tests

```bash
npm test
npm run test:integration   # local Supabase + Docker only; refuses production
npm run test:e2e           # Playwright; skip unless E2E_EMAIL / E2E_PASSWORD set
```

## Sales demo reset (internal org only)

```bash
npm run demo:reset
```

Allowlisted cloud project + demo organization only. Does not write official grid tables.

## Attention

One model for Overview KPI, Portfolio Attention, Development Brief, and Reports: `docs/attention-model.md`.
