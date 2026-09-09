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

A screening search stores customer criteria so it can be reproduced.

**Hard constraints** (can exclude a candidate when the required data is present):

- outside configured region or municipality
- site area below configured minimum
- customer-defined geographic mismatch

**Soft signals** influence ranking when evidence exists (grid covering context, strategic technology fit). Missing datasets are **insufficient evidence**, never a silent pass.

Configured but unsupported layers (protected areas, Natura 2000, slope, access, residential distance) are recorded on the search and explained on the assessment. They do not eliminate candidates until a supported provider exists.

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

Drivers: number of dimensions with available evidence, presence of official covering, missing datasets. Values: `high`, `medium`, `low`, `unknown`.

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

Supported:

- Energimarknadsinspektionen covering local-network areas (Sweden)
- Energimarknadsinspektionen covering network development plan areas (Sweden)

Not integrated (insufficient evidence, not a pass):

- Lantmäteriet
- Naturvårdsverket protected areas
- Natura 2000
- slope / terrain
- transport / roads
- residential distance
- any non-Swedish official geography

Provider keys live in `src/lib/opportunities/providers.ts`. Country expansion should add providers and rules, not rewrite the product.

## Known limitations

- New opportunity search records one candidate from the form; it does not auto-generate thousands of sites from national datasets.
- Funnel counts are stored workflow counts only. NOXHEIM does not invent “areas screened”.
- Map markers are org opportunities with coordinates. Viewport clustering of thousands of candidates is not required until a generator exists.
- Opportunity compare is query-param, max four, and is separate from saved project Development Profile comparisons.
- Hybrid / hydrogen / data-centre opportunity types promote onto existing project technologies (`other` or `industrial`).
