# Portfolio attention model

Authoritative implementation: `deriveProjectAttention` in `src/lib/intelligence/project-attention.ts`.

Overview KPI **Workflow attention**, the **Portfolio Attention** list, project **Development Brief** status, and Reports **projects needing workflow attention** all use this function.

**Open alerts** (bell, Alerts page, Reports “Open alerts”, Compare “Open alerts”) count stored `alerts` rows. That is not the same number as workflow attention.

Weekly digest “projects with open warning/critical alerts or overdue required items” is a SQL heuristic for email, not `deriveProjectAttention`.

This is **NOXHEIM-derived** workflow hygiene. It is not official grid advice, available connection capacity, or probability of connection.

## Levels

| Level | Meaning |
| --- | --- |
| Needs attention | High-severity workflow issues |
| Watch | Incomplete or missing workflow data that should be reviewed |
| On track | Workflow signals exist and none of the high/watch rules apply |
| Limited data | No connection case, requirements, open alerts, or target COD yet |

## Needs attention (KPI count)

A project is counted when any of these hold:

- Connection case status is At Risk or Overdue (customer entered)
- A required development action is overdue (customer entered)
- An open critical or warning **alert** exists (NOXHEIM-derived from stored alerts)

## Watch (listed, not in the KPI)

- Connection case Waiting
- Incomplete required actions that are not overdue
- Advanced connection stage with no connection case yet
- Team confidence Unknown
- Target COD missing

## What this is not

- Official source data
- Grid feasibility
- Forecast NUP transfer-capacity **need** interpreted as available MW
