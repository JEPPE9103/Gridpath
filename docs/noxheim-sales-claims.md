# NOXHEIM — Sales claims sheet

Practical language for design-partner outreach. Use this sheet before calls, demos, and follow-ups.

## What NOXHEIM does today

- Hosts a portfolio workspace for renewable and storage development teams.
- Stores customer-entered project, connection, requirement and document metadata.
- Matches project coordinates to **official Ei** local-network concession geography.
- Matches project coordinates to **official Ei** network development plan (NUP) planning areas.
- Surfaces published NUP answers (forecast transfer-capacity need, qualitative measures, etc.) with provenance.
- Tracks connection cases, application readiness and portfolio triage signals.
- Compares projects on a transparent **development profile** score (customer/workflow data only).
- Detects changes between ingested official source snapshots and maps them to portfolio projects.

## What is official source data

- Ei nätkoncessioner (local-network area geography).
- Ei nätutvecklingsplaner (NUP) — planning areas and published workbook answers.
- Publisher metadata, dataset dates, and NOXHEIM retrieval timestamps from `source_snapshots`.

Semantics: **forecast transfer-capacity need ≠ available capacity, headroom, or a connection offer.**

## What is customer data

- Project names, locations, MW, technology, target COD.
- Grid operator as entered on the project (may differ from official geography).
- **Team outlook** and **team confidence** — customer-entered triage assessments.
- Connection cases, requirements, document register entries, alerts, review decisions.

## What NOXHEIM derives

- Geographic project-to-area matches (local network and NUP).
- Portfolio development profile ranking from stored workflow fields.
- Change detection between official snapshots (when a new snapshot is ingested).
- Project impact matches from geography — **confirmed or dismissed by the customer**.

## What we must not claim

Do **not** say NOXHEIM provides or guarantees:

- Available grid capacity
- Headroom
- Guaranteed MW
- Grid feasibility
- Operator approval
- AI site recommendation
- Real-time monitoring
- Automated continuous monitoring

Also avoid: “live”, “real-time”, “automatically monitored”, “up to the minute”.

## Objection answers

### “Vattenfall already has a map.”

Operator maps show that operator’s own published material. NOXHEIM brings **official Ei datasets**, your **portfolio context**, connection workflow, requirements readiness, and change tracking into one workspace — without claiming available capacity.

### “Can you tell me whether 20 MW can connect here?”

No. NOXHEIM does not determine connectable MW. Formal grid assessment and operator response are always required. We show **official published context** and your **project workflow state** — not a connection guarantee.

### “How fresh is the data?”

Official Ei layers are loaded as **source snapshots** with published and retrieved dates shown in the product. During the design partner phase, NOXHEIM operations refresh sources on a supervised cadence — not continuous autonomous monitoring.

### “Why not Excel + GIS?”

Excel and GIS can hold data; NOXHEIM reduces friction between **official source geography**, **portfolio records**, **connection tracking**, and **published plan changes** — with explicit provenance and customer-entered vs official labelling.

### “What does the comparison score mean?”

The **development profile** is a portfolio triage heuristic from customer-entered outlook, confidence, application readiness, connection stage, open alerts and connection-case state. It is **not** a grid score, feasibility rating, or AI recommendation. Factor breakdown is shown in Map & Compare.
