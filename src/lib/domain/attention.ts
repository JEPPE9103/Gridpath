/**
 * Projects needing attention — same definition as Overview.
 *
 * A project is counted once if it has:
 * - an open critical or warning alert, or
 * - a connection case with status at_risk or overdue
 */
export function projectIdsNeedingAttention(
  cases: Array<{ project_id: string; status: string }>,
  alerts: Array<{ project_id: string | null; severity: string }>,
): Set<string> {
  const projectIds = new Set<string>();

  for (const row of alerts) {
    if (
      row.project_id &&
      (row.severity === "critical" || row.severity === "warning")
    ) {
      projectIds.add(row.project_id);
    }
  }

  for (const row of cases) {
    if (row.status === "at_risk" || row.status === "overdue") {
      projectIds.add(row.project_id);
    }
  }

  return projectIds;
}

export function countProjectsNeedingAttention(
  cases: Array<{ project_id: string; status: string }>,
  alerts: Array<{ project_id: string | null; severity: string }>,
): number {
  return projectIdsNeedingAttention(cases, alerts).size;
}
