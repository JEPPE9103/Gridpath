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

**Geographic search** (primary): the user supplies a bounding box (clipped to Sweden, max 15 000 km²) and a reusable organisation screening profile.

**Stage A — Discovery screening** divides the box into square **analysis cells** in SWEREF 99 TM (EPSG:3006). Cell size is `clamp(2000, 10000, sqrt(area_m² / 200))` metres, targeting about 200 cells. Coarse (~1 km) physical summaries may be used. Official exclusion polygons are subtracted with `ST_Difference`. Remaining usable polygons that share a boundary are dissolved (`ST_UnaryUnion` + `ST_Dump`). The user-facing object is a **Candidate Area**.

**Stage B — Detailed site screening** runs only on selected Candidate Areas (max 5). It uses ingested land-cover composition tiles (majority-class from native 10 m, targeting 50 m and capped at 100 m) and, when Geotorget is configured, on-demand Lantmäteriet 1 m DTM tiles. Pre-refinement geometry is retained. 1 km majority class is never presented as final site evidence. Processing resolution is labelled separately from the 10 m source.

**Hard constraints** (exclude when the required data is present):

- outside the configured bounding box
- **largest contiguous usable area** below configured minimum
- configured protected-area overlap ≥ 1% of the remaining fragment (Naturvårdsverket Naturvårdsregistret, when ingested)
- configured Natura 2000 overlap ≥ 1% (Naturvårdsverket N2000, when ingested)
- hard slope exclusion when Copernicus DEM summaries are ingested and mean slope of overlapping 1 km cells exceeds the configured threshold
- configured hard land-cover exclusions when NMD 2023 (or legacy NMD 2018 fallback) summaries are ingested
- hard road-distance exclusion when Trafikverket RoadLink is ingested
- outside configured region or municipality labels when the candidate has those fields

Copy for environmental hard fails: “Direct overlap with a configured protected-area exclusion.” This is **not** a legal impossibility finding.

Minimum-area fail copy: “No contiguous screened area meets the configured minimum X ha requirement.”

If an exclusion is configured but the layer is not ingested, candidates are **not** eliminated and must not be ranked `prioritise` / `investigate` from missing environmental evidence.

**Soft signals**: official Ei covering geography at the candidate centroid; terrain preference; land-cover preference against the organisation profile; road proximity. Covering is not a connection point and is not available capacity.

Unsupported (insufficient evidence, never a silent pass): residential proximity (licence/GDPR blocked), electricity infrastructure proximity, connection capacity, municipal planning, land ownership, official SE1–SE4 geometry, Lantmäteriet Grid 50+ DTM (Geotorget OAuth not configured).

SE1–SE4 may be stored as search intent. It is **not** used as a spatial clip.

## Recommendation language

| Stored value | UI language |
| --- | --- |
| `prioritise` | Priority for further investigation |
| `investigate` | Worth investigating |
| `secondary` | Secondary screening priority |
| `low_priority` | Do not prioritise based on current evidence |
| `insufficient_evidence` | Insufficient evidence to rank confidently |

Sweden, with coordinates, uses official Ei covering geography plus suitability-v3 weights (contiguous usable area, terrain, land cover, environmental, access, covering, completeness, and a non-overpowering strategic slot). Missing evidence scores 0, never a positive. Hard failures always rank last. Official county transmission context is **not** a ranking bonus until a structured SvK source exists.

- local-network **and** NUP covering, passing hard constraints → typically `prioritise`
- one covering layer → `investigate`
- queried, no covering polygon → `secondary`
- no official evidence → `insufficient_evidence`

Covering geography is not a connection point and is not available capacity. Ranking language may say “Priority #1 for further investigation” or that candidate A ranks above B based on currently supported evidence. It must not say “build here”, “guaranteed site”, “grid connection likely”, or “available capacity”.

## Data confidence

Data confidence describes how complete the **evidence** is, not probability of success.

- HIGH: several currently supported core dimensions with evidence (environmental, terrain, land cover, road, grid context) and no unevaluated critical exclusion
- MEDIUM: at least one official dimension and thinner but evaluated critical exclusions
- LOW / UNKNOWN: thinner evidence, failed ingest, or missing critical layers

A failed provider must reduce confidence. Confidence is never project success probability.

## Official datasets and licences

| Dataset | Publisher | Access | Licence | Commercial use | Attribution | Refresh |
| --- | --- | --- | --- | --- | --- | --- |
| Naturvårdsregistret `SkyddadeOmraden` | Naturvårdsverket | WFS `https://geodata.naturvardsverket.se/naturvardsregistret/wfs` | CC0 | Yes | Preferred: “Källa: Naturvårdsverket” | NOXHEIM cadence 168h |
| Natura 2000 `N2000` | Naturvårdsverket | WFS `https://geodata.naturvardsverket.se/n2000/wfs` | CC0 | Yes | Preferred: “Källa: Naturvårdsverket” | NOXHEIM cadence 168h |
| NMD 2023 basskikt v0.3 | Naturvårdsverket | Nationwide GeoTIFF `https://geodata.naturvardsverket.se/nedladdning/marktacke/NMD2023/Basskikt_v0_x/` | CC0 | Yes | Preferred: “NMD2023 v0.3, Naturvårdsverket” | Operator/scheduled ingest from local GeoTIFF (`NOXHEIM_NMD2023_TIF`). Discovery: 1 km majority class. Precision: majority-class tiles targeting 50 m (cap 100 m) for candidate refinement — not native 10 m. Mapping `nmd-group-v2`. |
| NMD 2018 basskikt | Naturvårdsverket | County GeoTIFF `https://geodata.naturvardsverket.se/nedladdning/marktacke/nmd2018/bas_lan_ogen/` | CC0 | Yes | Preferred: “NMD, Naturvårdsverket” | Legacy fallback only. Must not be labelled current when NMD 2023 is ingested for the geography. |
| Copernicus DEM GLO-90 | European Union / Copernicus | AWS public COG `https://copernicus-dem-90m.s3.amazonaws.com` | Copernicus WorldDEM-30 (free/open with attribution) | Yes | “Copernicus DEM, European Union” | Discovery / fallback DSM 90 m. **Not a DTM.** |
| Lantmäteriet Markhöjdmodell 1 m | Lantmäteriet | STAC `https://api.lantmateriet.se/stac-hojd/v1` | Product terms via Geotorget | Requires authorised Geotorget access | Lantmäteriet | Preferred detailed terrain. Candidate-scoped tiles only. `AUTH_REQUIRED` / `FALLBACK_ACTIVE` until credentials exist. |
| SCB Digitala gränser | Statistiska centralbyrån | WFS `https://geodata.scb.se/geoserver/stat/ows` | CC0 | Yes | “Källa: SCB” | Cartographic county/municipality for naming and filters. **Not cadastral analysis.** Never clips usable site geometry. |
| SvK 2026 capacity map | Svenska kraftnät | Interactive map only; no documented API | — | — | — | **Blocked.** TSO-DSO: API not provided. Not on data.svk.se. Not scraped. Official Indicative Transmission Context UI is implemented and remains unavailable. |
| INSPIRE RoadLink (NVDB) | Trafikverket | HTTPS WFS `https://geo-inspire.trafikverket.se/MapService/wfs.axd/TN_RoadTransportNetwork` | CC0 | Yes | Trafikverket NVDB | Scheduled/local bbox ingest with retries. Lastkajen remains the preferred bulk path when an operator has an account. OSM is not substituted. |
| Ei local-network concessions | Energimarknadsinspektionen | Existing ingest | Existing Ei terms | Existing | Ei | Existing |
| Ei network development plans | Energimarknadsinspektionen | Existing ingest | Existing Ei terms | Existing | Ei | Existing |

Lantmäteriet 1 m DTM is preferred for detailed screening when Geotorget is configured; Copernicus GLO-90 remains discovery/fallback. Residential / building data is **blocked pending access and GDPR**. Grid-infrastructure proximity is blocked pending a clearly documented commercially reusable source. Official SvK county capacity is blocked pending a structured source. Absence is shown as evidence unavailable.

Terrain methodology: Discovery uses Horn slope on GLO-90 DSM samples (~1 km). Detailed screening uses Lantmäteriet 1 m DTM on candidate tiles when configured. Slope is Noxheim Derived. Do not label an area “buildable” solely from slope.

Land-cover methodology: Current source is NMD 2023 basskikt v0.3 (`nmd-group-v2`), native **10 m**. Discovery downsamples to **1 km majority class**. Detailed screening majority-aggregates native 10 m cells into composition tiles targeting **50 m** (hard cap **100 m**, ~400 000 cells for a municipal bbox). Persisting nationwide 10 m polygons would be millions of rows per municipality (~9 million 10 m cells vs ~380 000 at 50 m for the Hallsberg example box). That processing resolution is **not** the source resolution and is labelled separately. NMD 2018 remains fallback. Code 41 is forest in 2018 and open land in 2023.

Candidate-area methodology: analysis cells → ST_Difference of configured exclusions → ST_UnaryUnion of remaining usable polygons → ST_Dump contiguous parts → drop slivers < 0.5 ha. Decision metric is largest contiguous usable area. Detailed refinement may further subtract ingested-tile excluded land-cover / steep terrain and persist pre-refinement geometry.

Ingest: `npm run dev:ingest-nv-protected`, `dev:ingest-nv-natura`, `dev:ingest-copernicus-slope -- --bbox=14.9,59.1,15.4,59.4`, `dev:ingest-nmd-2023 -- --tif=... --bbox=...`, `dev:ingest-scb-admin`, `dev:ingest-trafikverket-roads -- --bbox=...`. Rasters are never stored in git. Scheduled official ingest runs Ei + Naturvårdsverket WFS and optionally SCB, roads, and NMD 2023 when configured. Lantmäteriet tiles remain on-demand.

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
- Copernicus DEM GLO-90 derived 1 km slope summaries (DSM; discovery / fallback; Noxheim Derived slope)
- Naturvårdsverket NMD 2023 basskikt (current land cover; 1 km discovery + ≤100 m precision tiles when ingested; source remains 10 m)
- Naturvårdsverket NMD 2018 basskikt (legacy fallback only)
- Trafikverket INSPIRE RoadLink when the ingest succeeds (CC0)
- SCB Digitala gränser for naming and municipality/county attachment (not cadastral clip)

Not integrated (insufficient evidence, not a pass):

- Lantmäteriet 1 m DTM until Geotorget credentials are configured
- Official SvK 2026 county transmission capacity (no production-safe structured source)
- Lantmäteriet parcels / cadastral geometry
- electricity infrastructure proximity (substations, lines)
- available connection capacity
- municipal planning
- residential distance (licence / GDPR blocked)
- land ownership / legal access
- official electricity-area (SE1–SE4) geometry
- any non-Swedish official geography

Provider keys live in `src/lib/opportunities/providers.ts`. Country expansion should add providers and rules, not rewrite the product.

## Migration ordering

`20260911120000_site_suitability_engine.sql` is already on `main` and must not be renamed. Precision screening is `20260912120000_precision_screening.sql` so it sorts after that file. Future-style timestamps relative to calendar date are kept; new work must not sort before existing dependencies.

## Known limitations

- Analysis cells are an internal discovery mechanism. User-facing geometry is the Candidate Area; detailed screening may further change that geometry.
- Search results are not automatically saved as `development_opportunities`. The user saves chosen candidate areas; the save writes a decision-quality snapshot and assessment v1. Later ingest does not rewrite history.
- Copernicus GLO-90 is a DSM. Vegetation and buildings inflate slope versus a bare-earth DTM.
- NMD 2023 v0.3 is a 10 m landscape snapshot. Discovery coarsens to 1 km; detailed screening uses majority-class tiles targeting 50 m (capped at 100 m) when ingested — still not a parcel land-use map.
- Trafikverket WFS may fail; the dimension then stays insufficient evidence. Lastkajen is preferred when the operator has an account.
- Official SvK county capacity is not ingested. The UI states that limitation rather than scraping the map.
- Hybrid / hydrogen / data-centre opportunity types promote onto existing project technologies (`other` or `industrial`).
