import Link from "next/link";
import { buttonClassName } from "@/components/ui/button";
import type { ProjectDetailViewModel } from "@/lib/data/project-detail-types";
import {
  CONNECTION_READINESS_DISCLAIMER,
  connectionNextAction,
  groupConnectionRequirements,
} from "@/lib/domain/connection-workspace";
import { daysInCurrentStageLabel, deriveDaysInCurrentStage } from "@/lib/intelligence/project-attention";
import { formatDate } from "@/lib/format";

export function ConnectionApplicationSummary({ project }: { project: ProjectDetailViewModel }) {
  if (!project.connectionCase) {
    return (
      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Connection</h2>
        <p className="mt-2 text-sm text-muted">
          No connection application yet. Track the recorded process, requirements and deadlines in
          one workspace. NOXHEIM does not submit applications to network operators.
        </p>
        {project.canManageConnectionCase ? (
          <Link
            href={`/projects/${project.slug}/connection`}
            className={`${buttonClassName("secondary")} mt-4 inline-flex`}
          >
            Start connection application
          </Link>
        ) : (
          <Link
            href={`/projects/${project.slug}/connection`}
            className="mt-4 inline-flex text-sm font-medium text-teal hover:underline"
          >
            View connection workspace
          </Link>
        )}
      </section>
    );
  }

  const groups = groupConnectionRequirements(project.requirements);
  const nextAction = connectionNextAction({
    requirements: project.requirements,
    caseDeadline: project.connectionCase.deadline,
    caseStatusValue: project.connectionCase.statusValue,
    nextMilestone: project.connectionCase.nextMilestone,
    unreviewedOfficialChangeCount: project.officialChanges.unreviewed,
    projectSlug: project.slug,
    projectId: project.id,
  });
  const nextItem = groups.needsAttention[0] ?? groups.upcoming[0] ?? null;
  const readiness =
    project.readinessPercent == null
      ? "Workflow readiness not available"
      : `${project.readinessPercent}% workflow ready`;

  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Connection</h2>
          <p className="mt-1 text-sm">
            {project.connectionCase.stage}
            {" · "}
            {daysInCurrentStageLabel(
              deriveDaysInCurrentStage({
                hasConnectionCase: true,
                connectionCaseCreatedAt: project.connectionCase.createdAt,
                events: project.events,
              }).days,
            )}
            {" · "}
            {readiness}
          </p>
          <p className="mt-1 text-sm text-muted">
            {groups.outstandingRequiredCount} required item
            {groups.outstandingRequiredCount === 1 ? "" : "s"} outstanding
            {groups.overdueRequiredCount > 0
              ? ` · ${groups.overdueRequiredCount} overdue`
              : ""}
          </p>
          <p className="mt-2 text-sm">
            Next: {nextAction.kind === "none" ? nextAction.title : nextAction.title}
            {nextItem?.dueDate ? ` · ${formatDate(nextItem.dueDate)}` : ""}
          </p>
        </div>
        <Link
          href={`/projects/${project.slug}/connection`}
          className="text-sm font-medium text-teal hover:underline"
        >
          Open Connection Workspace
        </Link>
      </div>
      <p className="mt-3 text-xs leading-5 text-muted">{CONNECTION_READINESS_DISCLAIMER}</p>
    </section>
  );
}
