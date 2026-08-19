# NOXHEIM

Grid connection intelligence for professional energy developers.

NOXHEIM is a B2B workspace for screening sites, comparing connection opportunities, tracking operator processes, monitoring grid-information change, and keeping project documents in one place.

It does **not** guarantee grid capacity. The product distinguishes official data, indicative information, customer-provided files, and NOXHEIM analysis, and it surfaces confidence as High / Medium / Low.

This repository is a demonstration MVP with seeded Swedish portfolio data. It is built so a real API and database can replace the demo repositories later without rewriting the UI.

## Tech stack

- Next.js 16 (App Router)
- TypeScript
- React 19
- Tailwind CSS 4
- Lucide icons
- MapLibre GL
- Recharts (reports only)

## Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects to `/overview`.

```bash
npm run build
npm start
```

```bash
npm run lint
```

## Project structure

```
src/
  app/            App Router pages and layouts
  components/     Shared shell and UI primitives
  features/       Page-level feature views
  data/           Seeded demo dataset
  lib/            Repositories, persistence, formatting, ranking
  types/          Domain models
```

## Demo data architecture

Seeded data lives in `src/data/` (`projects`, `alerts`, `changes`, `connectionCases`, impact metrics).

UI components do not import seed files directly. They go through repository functions in `src/lib/repositories.ts`:

- `projectRepository`
- `alertRepository`
- `documentRepository`
- `changeRepository`
- `connectionRepository`
- `impactRepository`

Browser persistence (`localStorage`) stores lightweight demo mutations:

- dismissed alerts
- application-readiness checklist updates
- placeholder documents and status changes
- map compare selections

Those overlays are applied in the repositories so the UI always reads a consistent `Project` model.

## Replacing demo repositories later

Keep the TypeScript types in `src/types/index.ts` as the contract.

Swap repository implementations to call a real API, for example:

```ts
export const projectRepository = {
  async list(): Promise<Project[]> {
    const response = await fetch("/api/projects");
    return response.json();
  },
};
```

The feature views already consume repository outputs rather than hardcoded page data. Persistence should then move from `localStorage` to authenticated backend writes.

## Product notes for demos

- Default user: Anna Hellström, Portfolio Manager
- Portfolio: 11 Swedish sites (BESS, solar, wind, EV charging, industrial)
- Strongest screens: Overview alerts, project control centre, Map & Compare, Changes feed
- Capacity figures on public maps are labelled **indicative** unless an official offer or agreement exists
