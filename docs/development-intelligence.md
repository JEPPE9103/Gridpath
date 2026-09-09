# Development Intelligence

NOXHEIM helps development teams identify, screen and prioritise opportunities **before** a formal project exists, then promote the strongest candidates into the existing project lifecycle.

The product loop is:

Discover → Screen → Rank → Compare → Decide → Promote to project → Develop → Connect → Monitor

This module extends the existing product. It does not replace Portfolio, Grid Intelligence, Connection Workspace, Requirements, Documents, Timeline, Alerts, Reports or Attention.

## What NOXHEIM does not claim

NOXHEIM does **not** estimate available grid capacity unless a future verified data source explicitly supports that claim.

It also does not claim:

- guaranteed connection capacity
- probability of receiving a grid connection
- technical feasibility without evidence
- financial viability without customer assumptions
- “build here”
- certainty that a site is suitable

A recommendation means: based on currently available evidence and configured screening criteria, this opportunity ranks above these alternatives. It is not a prediction of project success.

## Domain model

An **Opportunity** belongs to an organisation and exists before a **Project**.

Lifecycle:

`identified` → `screening` → `strong_candidate` → `under_review` → `shortlisted` → `promoted`

Terminal alternative: `rejected` (kept for audit; not hard-deleted). Reopen returns it to `identified`.

Tables: `opportunity_searches`, `development_opportunities`, `opportunity_assessments`, `opportunity_events`. Projects gain `originating_opportunity_id`. Promoted opportunities store `promoted_project_id`.

See `docs/schema-contract.md` for columns and RPCs.

## Screening

A screening **search** stores customer criteria. A screening **run** is one execution of those criteria against currently ingested official layers.

**Geographic search** (primary): the user supplies a bounding box (clipped to Sweden, max 15 000 km²). NOXHEIM divides the box into square **screening cells** in SWEREF 99 TM (EPSG:3006). Cell size is `clamp(2000, 10000, sqrt(area_m² / 200))` metres, targeting about 200 cells. Adjacent cells are **not** merged. Results are **candidate / screening areas**, not cadastral parcels or land for purchase.

**Single-point search** remains available for a known coordinate.

**Hard constraints** (exclude when the required data is present):

- outside the configured bounding box
- usable assessed area below configured minimum (cell area minus configured overlapping exclusions)
- configured protected-area overlap ≥ 1% of the cell (Naturvårdsverket Naturvårdsregistret, when ingested)
- configured Natura 2000 overlap ≥ 1% of the cell (Naturvårdsverket N2000, when ingested)
- outside configured region or municipality labels when the candidate has those fields

Copy for environmental hard fails: “Direct overlap with a configured protected-area exclusion.” This is **not** a legal impossibility finding.

If an exclusion is configured but the layer is not ingested, candidates are **not** eliminated and must not be ranked `prioritise` / `investigate` from missing environmental evidence.

**Soft signals**: official Ei covering geography at the cell centroid (local-network and/or NUP). Covering is not a connection point and is not available capacity.

Unsupported in this release (insufficient evidence, never a silent pass): terrain/slope, land cover, electricity infrastructure proximity, connection capacity, municipal planning, roads, residential distance, land ownership, official SE1–SE4 geometry.

SE1–SE4 may be stored as search intent. It is **not** used as a spatial clip.

## Recommendation language

| Stored value | UI language |
| --- | --- |
| `prioritise` | Priority for further investigation |
| `investigate` | Worth investigating |
| `secondary` | Secondary screening priority |
| `low_priority` | Do not prioritise based on current evidence |
| `insufficient_evidence` | Insufficient evidence to rank confidently |

Sweden, with coordinates, uses official Ei covering geography:

- local-network **and** NUP covering → `prioritise`
- one covering layer → `investigate`
- queried, no covering polygon → `secondary`
- no official evidence → `insufficient_evidence`

Covering geography is not a connection point and is not available capacity.

## Data confidence

Data confidence describes how complete the **evidence** is, not probability of success.

- HIGH: at least two official dimensions and at least four available dimensions, with no unevaluated critical exclusion
- MEDIUM: at least one official dimension and at least three available dimensions, critical exclusions evaluated
- LOW / UNKNOWN: thinner evidence or missing critical layers

## Official datasets and licences

| Dataset | Publisher | Access | Licence | Commercial use | Attribution | Refresh |
| --- | --- | --- | --- | --- | --- | --- |
| Naturvårdsregistret `SkyddadeOmraden` | Naturvårdsverket | WFS `https://geodata.naturvardsverket.se/naturvardsregistret/wfs` | CC0 | Yes | Preferred: “Källa: Naturvårdsverket” | NOXHEIM cadence 168h |
| Natura 2000 `N2000` | Naturvårdsverket | WFS `https://geodata.naturvardsverket.se/n2000/wfs` | CC0 | Yes | Preferred: “Källa: Naturvårdsverket” | NOXHEIM cadence 168h |
| Ei local-network concessions | Energimarknadsinspektionen | Existing ingest | Existing Ei terms | Existing | Ei | Existing |
| Ei network development plans | Energimarknadsinspektionen | Existing ingest | Existing Ei terms | Existing | Ei | Existing |

Terrain (Lantmäteriet Grid 50+), NMD land cover, and distribution/transmission asset layers are **not ingested**. Grid-infrastructure proximity is blocked pending a clearly documented, commercially reusable source. Absence of those layers is shown as evidence unavailable.

Ingest: `npm run dev:ingest-nv-protected` and `npm run dev:ingest-nv-natura` (local). Scheduled official ingest also runs the cloud NV scripts after Ei.

## Provenance

Each assessment dimension has `source_kind`:

- Customer Data (`customer_data`)
- Official Source (`official`)
- Noxheim Derived (`noxheim_derived`)

Noxheim Derived must not be presented as Official Source.

## Promote to project

`promote_opportunity_to_project` creates a project through `create_project_with_primary_site`, links both directions, writes history, and refuses a second promotion. Coordinates are required because project creation requires a primary site.

After promotion, Connection Workspace, Requirements, Documents, monitoring and Attention run on the **project**, not a duplicate opportunity workflow.

## Security

Same write matrix as projects: Viewer can read; owner/admin/member can write and promote. RLS uses `private.belongs_to_organization` / `private.can_write_organization`. Deletes of opportunity records are admin-only.

Geometry, criteria and assessments are org-scoped. There is no cross-org access.

## Current supported data layers

Supported when ingested:

- Energimarknadsinspektionen covering local-network areas (Sweden)
- Energimarknadsinspektionen covering network development plan areas (Sweden)
- Naturvårdsverket Naturvårdsregistret protected areas (Sweden, CC0)
- Naturvårdsverket Natura 2000 (Sweden, CC0)

Not integrated (insufficient evidence, not a pass):

- Lantmäteriet parcels / terrain
- slope / terrain raster
- land cover
- electricity infrastructure proximity (substations, lines)
- available connection capacity
- municipal planning
- transport / roads
- residential distance
- land ownership / legal access
- official electricity-area (SE1–SE4) geometry
- any non-Swedish official geography

Provider keys live in `src/lib/opportunities/providers.ts`. Country expansion should add providers and rules, not rewrite the product.

## Known limitations

- Geographic search uses screening cells, not parcel-perfect sites. Precision is the cell size stored on the run.
- Adjacent qualifying cells are not merged in this release.
- Search results are not automatically saved as `development_opportunities`. The user saves chosen candidate areas.
- Funnel counts are stored workflow counts only. Search-run evaluated/excluded/returned counts are actual cell counts.
- Terrain, land cover, roads and infrastructure proximity are unsupported; the UI must say evidence unavailable rather than invent distances.
- Hybrid / hydrogen / data-centre opportunity types promote onto existing project technologies (`other` or `industrial`).
