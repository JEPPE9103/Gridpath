import type { ProjectDetailViewModel } from "@/lib/data/project-detail-types";
import { isUnmatchedReviewProject } from "@/lib/domain/official-map";
import type { ProjectAttentionInput } from "@/lib/intelligence/types";

export function attentionInputFromProjectDetail(project: ProjectDetailViewModel): ProjectAttentionInput {
  const localAreaId = project.officialGridAreaContext?.areas[0]?.id ?? null;
  const nupAreaId = project.officialNetworkDevelopmentPlanContext?.planningAreas[0]?.id ?? null;
  return {
    stage: project.stage,
    confidence: project.confidence,
    targetCOD: project.targetCOD,
    connectionCaseStatus: project.connectionCase?.status ?? null,
    connectionCaseStatusValue: project.connectionCase?.statusValue ?? null,
    hasConnectionCase: Boolean(project.connectionCase),
    requirements: project.requirements,
    openAlertSeverities: project.alerts.map((alert) => alert.severity),
    unreviewedOfficialChangeCount: project.officialChanges.unreviewed,
    connectionDeadline: project.connectionCase?.deadline ?? null,
    nextMilestone: project.connectionCase ? project.connectionCase.nextMilestone ?? "" : undefined,
    connectionCaseCreatedAt: project.connectionCase?.createdAt ?? null,
    connectionCaseOwnerAssigned: project.connectionCase
      ? Boolean(project.connectionCase.ownerName)
      : null,
    events: project.events.map((event) => ({
      title: event.title,
      occurredAt: event.occurredAt,
    })),
    lastActivityAt: project.events[0]?.occurredAt ?? null,
    unmatchedOfficialGeography: isUnmatchedReviewProject(
      { projectId: project.id, localAreaId, nupAreaId },
      project.hasCoordinates,
    ),
    projectSlug: project.slug,
    projectId: project.id,
  };
}
