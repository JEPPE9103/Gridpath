export type AlertType = "external_change" | "requirement_deadline" | "connection_deadline";

export type DeadlineKind = "approaching" | "overdue";

export function changeImpactAlertNaturalKey(changeImpactId: string): string {
  return `change_impact:${changeImpactId}`;
}

export function requirementAlertNaturalKey(requirementId: string, kind: DeadlineKind): string {
  return `requirement:${requirementId}:${kind}`;
}

export function connectionAlertNaturalKey(caseId: string, kind: DeadlineKind): string {
  return `connection:${caseId}:${kind}`;
}

export function isOpenAlertStatus(status: string | null | undefined): boolean {
  return status === "open";
}

export function isActionableAlertStatus(status: string | null | undefined): boolean {
  return status === "open";
}
