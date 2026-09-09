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

**Geographic search** (primary): the user supplies a bounding box (clipped to Sweden, max 15 000 km²) and a reusable organisation screening profile. NOXHEIM divides the box into square **analysis cells** in SWEREF 99 TM (EPSG:3006). Cell size is `clamp(2000, 10000, sqrt(area_m² / 200))` metres, targeting about 200 cells.

Official exclusion polygons are subtracted with `ST_Difference`. Remaining usable polygons that share a boundary are dissolved (`ST_UnaryUnion` + `ST_Dump`). Corner-only and disconnected fragments stay separate. Centroids are not used. Geometry is repaired with `ST_MakeValid` / `ST_CollectionExtract`; slivers below 0.5 ha are dropped.

The user-facing object is a **Candidate Area** — the contiguous remaining usable polygon — not the original analysis square and not a cadastral parcel.

**Hard constraints** (exclude when the required data is present):

- outside the configured bounding box
- **largest contiguous usable area** below configured minimum
- configured protected-area overlap ≥ 1% of the remaining fragment (Naturvårdsverket Naturvårdsregistret, when ingested)
- configured Natura 2000 overlap ≥ 1% (Naturvårdsverket N2000, when ingested)
- hard slope exclusion when Copernicus DEM summaries are ingested and mean slope of overlapping 1 km cells exceeds the configured threshold
- configured hard land-cover exclusions when NMD 2018 summaries are ingested
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

Sweden, with coordinates, uses official Ei covering geography plus suitability-v2 weights (contiguous usable area, environmental, terrain, land cover, road, covering, completeness). Missing evidence scores 0, never a positive. Hard failures always rank last.

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
| NMD 2018 basskikt | Naturvårdsverket | County GeoTIFF `https://geodata.naturvardsverket.se/nedladdning/marktacke/nmd2018/bas_lan_ogen/` | CC0 | Yes | Preferred: “NMD, Naturvårdsverket” | Operator ingest; 10 m raster coarsened to 1 km majority class, EPSG:3006 → 4326 |
| Copernicus DEM GLO-90 | European Union / Copernicus | AWS public COG `https://copernicus-dem-90m.s3.amazonaws.com` | Copernicus WorldDEM-30 (free/open with attribution) | Yes | “Copernicus DEM, European Union” | Operator bbox ingest; 90 m DSM; Noxheim-derived Horn slope on ~1 km bins. **Not a DTM. Not Lantmäteriet Grid 50+.** |
| INSPIRE RoadLink (NVDB) | Trafikverket | HTTPS WFS `https://geo-inspire.trafikverket.se/MapService/wfs.axd/TN_RoadTransportNetwork` | CC0 | Yes | Trafikverket NVDB | Operator bbox ingest. WFS has been unstable; failures are recorded. OSM is not substituted. |
| Ei local-network concessions | Energimarknadsinspektionen | Existing ingest | Existing Ei terms | Existing | Ei | Existing |
| Ei network development plans | Energimarknadsinspektionen | Existing ingest | Existing Ei terms | Existing | Ei | Existing |

Lantmäteriet Grid 50+ is CC0 but requires Geotorget OAuth — **not ingested**. Residential / building data is **blocked pending access and GDPR**. Grid-infrastructure proximity is blocked pending a clearly documented commercially reusable source. Absence is shown as evidence unavailable.

Terrain methodology: Horn slope on GLO-90 DSM samples, summarised as mean / median / P90 / % ≤ 5° / 8° / 12° on ~0.01° cells. Screening may hard-exclude 1 km cells whose mean slope exceeds the configured threshold, or treat slope as a preference.

Land-cover methodology: NMD 2018 class codes mapped to water / wetland / forest / agriculture / open / developed / unclassified. Evaluation is against the organisation profile (PREFERRED / NEUTRAL / DEPRIORITISED / EXCLUDED), never a universal good/bad ranking.

Candidate-area methodology: analysis cells → ST_Difference of configured exclusions → ST_UnaryUnion of remaining usable polygons → ST_Dump contiguous parts → drop slivers < 0.5 ha. Decision metric is largest contiguous usable area.

Ingest: `npm run dev:ingest-nv-protected`, `dev:ingest-nv-natura`, `dev:ingest-copernicus-slope -- --bbox=14.9,59.1,15.4,59.4`, `dev:ingest-nmd-land-cover -- --county=T`, `dev:ingest-trafikverket-roads -- --bbox=...`. Rasters are never stored in git. Scheduled official ingest still runs Ei + Naturvårdsverket WFS; physical layers are operator-triggered because of volume.

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
- Copernicus DEM GLO-90 derived 1 km slope summaries (DSM; Noxheim Derived slope)
- Naturvårdsverket NMD 2018 basskikt 1 km majority class (CC0)
- Trafikverket INSPIRE RoadLink when the WFS ingest succeeds (CC0)

Not integrated (insufficient evidence, not a pass):

- Lantmäteriet parcels / Grid 50+ DTM (Geotorget OAuth not configured)
- electricity infrastructure proximity (substations, lines)
- available connection capacity
- municipal planning
- residential distance (licence / GDPR blocked)
- land ownership / legal access
- official electricity-area (SE1–SE4) geometry
- any non-Swedish official geography

Provider keys live in `src/lib/opportunities/providers.ts`. Country expansion should add providers and rules, not rewrite the product.

## Known limitations

- Analysis cells are an internal mechanism. User-facing geometry is the dissolved Candidate Area, simplified for the browser.
- Search results are not automatically saved as `development_opportunities`. The user saves chosen candidate areas; the save writes a decision-quality snapshot that later ingest does not rewrite.
- Funnel counts are stored workflow counts only. Search-run evaluated/excluded/returned counts are actual candidate-area counts.
- Copernicus GLO-90 is a DSM. Vegetation and buildings inflate slope versus a bare-earth DTM.
- NMD 2018 is a 2018 landscape snapshot coarsened to 1 km for screening, not a parcel land-use map.
- Trafikverket WFS may fail; the dimension then stays insufficient evidence.
- Hybrid / hydrogen / data-centre opportunity types promote onto existing project technologies (`other` or `industrial`).
