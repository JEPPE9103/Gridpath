# Portfolio attention model

Authoritative implementation: `deriveProjectAttention` in `src/lib/intelligence/project-attention.ts`.

Overview **Do next**, the **Portfolio attention** list, project **Project attention**, Connection Application next action, and Reports **Action required** all use this function.

**Open alerts** (bell, Alerts page, Reports “Open alerts”, Compare “Open alerts”) count stored `alerts` rows. That is not the same number as workflow Action required.

Weekly digest “projects with open warning/critical alerts or overdue required items” is a SQL heuristic for email, not `deriveProjectAttention`.

This is **NOXHEIM-derived** workflow hygiene. It is not official grid advice, available connection capacity, or probability of connection. There is no numeric risk score.

## Bands

| Band | KPI / Overview | Meaning |
| --- | --- | --- |
| Action required | Counted in Action required | Overdue required items, overdue connection deadlines, customer-entered At Risk / Overdue case status, open critical/warning alerts |
| Watch | Listed, not in the Action required count | Required item or connection deadline due within 7 days; official change awaiting review |
| Review | Listed on the project, not in Overview “Do next” | Completeness / hygiene only |
| Clear | Hidden | No current attention signals |

## Action required

- Required requirement overdue
- Connection case deadline overdue (active case)
- Connection case status At Risk or Overdue (customer entered)
- Open critical or warning alert

## Watch

- Required requirement due within 7 days
- Connection deadline due within 7 days
- Unreviewed official change (team relevance, not a technical impact verdict)

## Review

- No next milestone recorded
- No connection-case owner assigned
- Connection case exists but no required workflow items defined
- Official grid geography needs review (no covering official area)
- No recorded project activity in 30 days
- Waiting case, incomplete required items that are not due soon, missing case at advanced stage, unknown confidence, missing target COD

## Stage duration

Days in current stage come from the latest `Connection stage changed` event. If none exists, the connection case `created_at` is used. Otherwise duration is unavailable. NOXHEIM does not say the stage is taking too long.

## Next action

Deterministic order: overdue required item → required item due soon → overdue connection deadline → connection deadline due soon → official change awaiting review → incomplete required item → missing next milestone → no immediate action identified.

## What this is not

- Official source data
- Grid feasibility
- Forecast NUP transfer-capacity **need** interpreted as available MW
- A risk, probability, or feasibility score
