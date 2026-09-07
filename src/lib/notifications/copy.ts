export function impactEmailSubject(projectName: string): string {
  return `Official grid publication changed — ${projectName} may be relevant`;
}

export function impactEmailText(input: {
  projectName: string;
  sourceName: string;
  detectedAtLabel: string;
  appUrl: string;
}): string {
  return [
    `An official grid publication changed. ${input.projectName} geographically overlaps the affected official area and may be relevant.`,
    "",
    `Official source: ${input.sourceName}`,
    `Detected by Noxheim: ${input.detectedAtLabel}`,
    "",
    "This is geographic relevance for review. It does not mean the project is technically impacted, and it is not a statement of available grid capacity.",
    "",
    `Review in Noxheim: ${input.appUrl}/changes`,
  ].join("\n");
}

export type WeeklyDigestPayload = {
  organizationName: string;
  periodKey: string;
  activeProjectCount: number;
  attentionProjectCount: number;
  newImpactCount: number;
  overdueRequiredCount: number;
  approachingDeadlineCount: number;
  addedProjectCount: number;
  archivedProjectCount: number;
};

export function isDigestEmpty(payload: WeeklyDigestPayload): boolean {
  return (
    payload.attentionProjectCount === 0 &&
    payload.newImpactCount === 0 &&
    payload.overdueRequiredCount === 0 &&
    payload.approachingDeadlineCount === 0 &&
    payload.addedProjectCount === 0 &&
    payload.archivedProjectCount === 0
  );
}

export function weeklyDigestSubject(organizationName: string): string {
  return `Noxheim weekly summary — ${organizationName}`;
}

export function weeklyDigestText(payload: WeeklyDigestPayload, appUrl: string): string {
  return [
    `This week in your portfolio — ${payload.organizationName}.`,
    "",
    "Official publications",
    `New geographically matched official changes (7 days): ${payload.newImpactCount}`,
    "",
    "Workflow",
    `Projects with open warning/critical alerts or overdue required items: ${payload.attentionProjectCount}`,
    `Overdue required items: ${payload.overdueRequiredCount}`,
    `Approaching connection deadlines: ${payload.approachingDeadlineCount}`,
    `Projects added (7 days): ${payload.addedProjectCount}`,
    `Projects archived (7 days): ${payload.archivedProjectCount}`,
    `Active projects: ${payload.activeProjectCount}`,
    "",
    "This digest count is not the same as Overview “workflow attention”, which uses the full project attention model.",
    "Official changes are published-source matches for review. They are not technical impact verdicts or available-capacity statements.",
    "",
    `Review changes: ${appUrl}/changes`,
    `Open Noxheim: ${appUrl}/overview`,
  ].join("\n");
}

export function emailWouldClaimSent(status: "attempted" | "accepted" | "failed"): boolean {
  return status === "accepted";
}
