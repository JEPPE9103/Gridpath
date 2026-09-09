"use client";

import { cn } from "@/lib/cn";
import { StageBadge } from "@/components/ui/badges";
import { attentionInputFromProjectDetail } from "@/lib/intelligence/from-project-detail";
import {
  attentionBandLabel,
  attentionLevelLabel,
  buildDevelopmentBriefSummary,
  deriveProjectAttention,
  daysInCurrentStageLabel,
  formatWorkflowReadinessLabel,
  lastActivityLabel,
  summarizeOfficialContext,
  type AttentionBand,
  type ProjectAttentionLevel,
} from "@/lib/intelligence";
import type { ProjectDetailViewModel } from "@/lib/data/project-detail-types";
import { formatDate, formatImportExport } from "@/lib/format";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";

const LEVEL_STYLES: Record<
  ProjectAttentionLevel,
  { badge: string; border: string; label: string }
> = {
  needs_attention: {
    badge: "border-warning/30 bg-warning-bg text-warning",
    border: "border-l-warning",
    label: "Action required",
  },
  watch: {
    badge: "border-info/30 bg-info-bg text-info",
    border: "border-l-info",
    label: "Watch",
  },
  on_track: {
    badge: "border-success/30 bg-success-bg text-success",
    border: "border-l-success",
    label: "On Track",
  },
  insufficient_data: {
    badge: "border-line bg-canvas text-muted",
    border: "border-l-line",
    label: "Limited Data",
  },
};

export function DevelopmentBrief({ project }: { project: ProjectDetailViewModel }) {
  const brief = useMemo(() => {
    const officialContext = summarizeOfficialContext(
      project.officialGridAreaContext,
      project.officialNetworkDevelopmentPlanContext,
    );

    const attention = deriveProjectAttention(attentionInputFromProjectDetail(project));

    return {
      summary: buildDevelopmentBriefSummary({
        name: project.name,
        technology: project.technology,
        exportMW: project.exportMW,
        importMW: project.importMW,
        stage: project.stage,
        targetCOD: project.targetCOD,
        connectionCase: project.connectionCase
          ? {
              caseId: project.connectionCase.caseId,
              stage: project.connectionCase.stage,
              status: project.connectionCase.status,
            }
          : null,
        readinessPercent: project.readinessPercent,
        readinessCompleteCount: project.readinessCompleteCount,
        readinessRequiredCount: project.readinessRequiredCount,
        officialContext,
        attention,
        recentEvents: project.events.slice(0, 3).map((event) => ({
          title: event.title,
          occurredAt: event.occurredAt,
        })),
      }),
      attention,
    };
  }, [project]);

  const styles = LEVEL_STYLES[brief.summary.statusLevel];
  const officialContext = summarizeOfficialContext(
    project.officialGridAreaContext,
    project.officialNetworkDevelopmentPlanContext,
  );
  const attentionSignals = brief.attention.signals.slice(0, 3);
  const stageName = project.connectionCase?.stage ?? project.stage;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border border-line bg-surface border-l-4",
        styles.border,
      )}
      aria-labelledby="development-brief-heading"
    >
      <div className="border-b border-line px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Development Brief
            </p>
            <h2 id="development-brief-heading" className="mt-1 text-lg font-semibold text-ink">
              {project.name}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {formatImportExport(project)} · {project.technology}
              {project.targetCOD ? ` · Target COD ${project.targetCOD}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Status</p>
            <span
              className={cn(
                "mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                styles.badge,
              )}
            >
              {attentionLevelLabel(brief.summary.statusLevel)}
            </span>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-ink">{brief.summary.headline}</p>
      </div>

      <div className="border-b border-line px-5 py-4">
        <h3 className="text-sm font-semibold text-ink">Project attention</h3>
        <p className="mt-1 text-sm text-muted">
          {stageName}
          {project.connectionCase
            ? ` · ${daysInCurrentStageLabel(brief.attention.daysInCurrentStage)}`
            : ""}
        </p>
        <p className="mt-1 text-xs text-muted">{lastActivityLabel(brief.attention.lastActivityAt)}</p>
        {attentionSignals.length === 0 ? (
          <p className="mt-3 text-sm text-ink">No immediate action identified.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {attentionSignals.map((signal) => (
              <li key={signal.type} className="text-sm">
                <p className="font-medium text-ink">
                  {attentionBandLabel(signal.severity as AttentionBand)}
                </p>
                <p className="text-muted">
                  {signal.href ? (
                    <Link href={signal.href} className="text-teal hover:underline">
                      {signal.title}
                    </Link>
                  ) : (
                    signal.title
                  )}
                  {signal.detail ? ` · ${signal.detail}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm">
          <span className="text-muted">Next action: </span>
          {brief.attention.nextAction.href ? (
            <Link href={brief.attention.nextAction.href} className="font-medium text-teal hover:underline">
              {brief.attention.nextAction.title}
            </Link>
          ) : (
            <span className="font-medium text-ink">{brief.attention.nextAction.title}</span>
          )}
        </p>
      </div>

      <div className="grid gap-px border-b border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
        <BriefColumn title="Connection" source="Your team">
          {project.connectionCase ? (
            <>
              <p className="font-medium text-ink">
                <StageBadge stage={project.connectionCase.stage} />
              </p>
              <p className="mt-2 text-sm text-ink">{project.connectionCase.status}</p>
              <p className="mt-1 font-mono text-xs text-muted">
                {project.connectionCase.caseId ?? "No reference recorded"}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">No connection case created yet.</p>
          )}
        </BriefColumn>

        <BriefColumn title="Workflow" source="Noxheim derived">
          <p className="text-2xl font-semibold text-ink">
            {formatWorkflowReadinessLabel(
              project.readinessPercent,
              project.readinessCompleteCount,
              project.readinessRequiredCount,
            )}
          </p>
          {project.readinessRequiredCount > 0 ? (
            <p className="mt-1 text-sm text-muted">
              {project.readinessCompleteCount} / {project.readinessRequiredCount} required
              complete
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">No required actions recorded yet.</p>
          )}
        </BriefColumn>

        <BriefColumn title="Official context" source="Official source">
          <ul className="space-y-1 text-sm text-ink">
            <li>
              {officialContext.localNetworkAvailable
                ? "Local-network context available"
                : "Local-network context not matched"}
            </li>
            <li>
              {officialContext.nupAvailable
                ? "NUP context available"
                : "NUP context not matched"}
            </li>
          </ul>
        </BriefColumn>

        <BriefColumn title="Freshness" source="Official source">
          {officialContext.latestRetrievedAt ? (
            <>
              <p className="text-sm text-ink">Latest relevant official source retrieved</p>
              <p className="mt-1 font-medium text-ink">
                {formatDate(officialContext.latestRetrievedAt)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">No official retrieval date recorded yet.</p>
          )}
        </BriefColumn>
      </div>

      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">Recent activity</h3>
          {project.events.length > 0 ? (
            <Link
              href={`/projects/${project.slug}?tab=activity`}
              className="text-xs font-medium text-teal hover:underline"
            >
              View all
            </Link>
          ) : null}
        </div>
        {project.events.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No project activity recorded yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {project.events.slice(0, 3).map((event) => (
              <li key={event.id} className="text-sm">
                <p className="font-medium text-ink">{event.title}</p>
                <p className="text-xs text-muted">{formatDate(event.occurredAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function BriefColumn({
  title,
  source,
  children,
}: {
  title: string;
  source: "Your team" | "Official source" | "Noxheim derived";
  children: ReactNode;
}) {
  return (
    <div className="bg-surface px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</h3>
        <span className="text-[10px] uppercase tracking-wide text-muted">{source}</span>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
