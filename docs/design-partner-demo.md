# NOXHEIM — 15-minute sales demo

Canonical host: `https://www.noxheim.com`

Workspace: **Northfield Energy Development AB** (internal sales demo, slug `noxheim-demo-development`).  
Primary Discovery: **Örebro East BESS**  
Promoted Project: **Örebro East Storage** → `/projects/orebro-east-storage`  
Connection hero: **Stockholm North BESS** → `/projects/stockholm-north-bess`

Customer-entered portfolio/workflow rows are **sample data**. Official Grid Intelligence is the **current NOXHEIM official Ei baseline**. Candidate Sites come from a **real demo-org screening run**, not hand-drawn polygons.

This script assumes a completed sales-demo reset, including the post-transaction screening phase.

---

## Global DO NOT SAY

- available grid capacity / available MW / headroom
- connection feasibility / guaranteed connection
- that the map is a capacity map or “best places to build”
- AI recommendation / AI site score
- that Sample landing previews are the live demo workspace
- invented official changes or operator approvals

---

## 00:00–02:00 — Map / portfolio orientation

**SHOW:** `/map` after login. National Sweden. Projects visible. No Discovery run selected.

**SAY:** This is the development portfolio in one workspace — not a capacity map.

**DO NOT SAY:** Recommended locations / available MW.

---

## 02:00–05:00 — Select Örebro East BESS

**SHOW:** Discovery run **Örebro East BESS**. Search Area, Candidate Sites, official local-network covering.

**SAY:** These Candidate Sites are generated from official geography for this search. Ranking is for investigation, not constructability.

**DO NOT SAY:** Best places to build / guaranteed sites.

---

## 05:00–08:00 — Candidate, Evidence, Compare

**SHOW:** One Candidate Site panel, Evidence Coverage, then Compare 2–3 real Örebro East sites.

**SAY:** Coverage and missing categories are Noxheim-derived. We do not invent a score when evidence is missing.

**DO NOT SAY:** Official grid score, capacity score, or feasibility score.

---

## 08:00–11:00 — Opportunity → Örebro East Storage

**SHOW:** Saved Opportunities, then the promoted project `/projects/orebro-east-storage`.

**SAY:** The team saved a Candidate, then promoted it. The Project is a point. The Opportunity footprint stays as the historic development envelope.

**DO NOT SAY:** That the Project polygon is official.

---

## 11:00–15:00 — Connection + Overview

**SHOW:** `/projects/stockholm-north-bess` Connection Process (`NF-STO-001`), then `/overview`.

**SAY:** Connection workflow is customer-entered beside official covering. Overview Attention is derived from that workflow. Empty Changes is the honest official baseline.

**DO NOT SAY:** That Ei supplied the case, or invent alerts.

---

## 5-minute version

Map → Örebro East Candidates → Evidence → Compare → Overview.

The three moments most likely to earn “show me that”:

1. Candidate Sites on the Map with official covering
2. Evidence Coverage / missing categories
3. Compare two real sites and say why one is worth investigating

---

## Customer questions

**Is this a capacity map?**  
No. The map represents your project portfolio and Discovery search. Official grid context is attached where it covers the geography.

**Can you tell me whether 40 MW can connect?**  
No. Formal connection capacity still requires the relevant network operator.

**Why not Vattenfall’s map?**  
A network operator’s tool describes its network. Your portfolio can span multiple operators. NOXHEIM is centred on the developer’s portfolio.

---

## Reset commands (do not run against cloud without a separate approved task)

```bash
npm run demo:plan
npm run demo:preflight
# Remote destructive reset also requires:
# NOXHEIM_CONFIRM_DEMO_RESET=noxheim-demo-development
npm run demo:reset
```
