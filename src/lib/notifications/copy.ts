export function impactEmailSubject(projectName: string): string {
  return `New external information may be relevant to ${projectName}`;
}

export function impactEmailText(input: {
  projectName: string;
  sourceName: string;
  detectedAtLabel: string;
  appUrl: string;
}): string {
  return [
    `New external information may be relevant to ${input.projectName}.`,
    "",
    `Official source: ${input.sourceName}`,
    `Detected by Noxheim: ${input.detectedAtLabel}`,
    "",
    "This means a published change is geographically relevant to the project. It does not mean the project will be negatively affected, and it is not a statement of available grid capacity.",
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
    `Weekly portfolio summary for ${payload.organizationName}.`,
    "",
    `Active projects: ${payload.activeProjectCount}`,
    `Projects with open warning/critical alerts or overdue required items: ${payload.attentionProjectCount}`,
    `New geographically matched published changes (7 days): ${payload.newImpactCount}`,
    `Overdue required items: ${payload.overdueRequiredCount}`,
    `Approaching connection deadlines: ${payload.approachingDeadlineCount}`,
    `Projects added (7 days): ${payload.addedProjectCount}`,
    `Projects archived (7 days): ${payload.archivedProjectCount}`,
    "",
    "This digest count is not the same as Overview “workflow attention”, which uses the full project attention model.",
    "",
    `Open Noxheim: ${appUrl}/overview`,
  ].join("\n");
}

export function emailWouldClaimSent(status: "attempted" | "accepted" | "failed"): boolean {
  return status === "accepted";
}
