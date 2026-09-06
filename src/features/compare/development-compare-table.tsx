"use client";

import { ConfidenceBadge, OutlookBadge } from "@/components/ui/badges";
import { cn } from "@/lib/cn";
import type { MapProject } from "@/lib/data/map-types";
import {
  rankingExplanation,
  strongestDevelopmentProfile,
  formatFactorPoints,
} from "@/lib/domain/development-profile";
import { buildDevelopmentProfileExplanation } from "@/lib/intelligence/compare-explanation";
import Link from "next/link";
import type { ReactNode } from "react";

function locationLabel(project: MapProject): string {
  return project.location || "—";
}

function readinessLabel(percent: number | null): string {
  return percent == null ? "—" : `${percent}%`;
}

function attentionLabel(project: MapProject): string {
  const critical = project.openAlerts.filter((alert) => alert.severity === "critical").length;
  const warning = project.openAlerts.filter((alert) => alert.severity === "warning").length;
  if (critical === 0 && warning === 0) {
    return "None open";
  }
  return `${critical} critical · ${warning} warning`;
}

function milestoneLabel(project: MapProject): string {
  return project.connectionCase?.nextMilestone || "—";
}

export function DevelopmentCompareTable({
  projects,
  onRemove,
}: {
  projects: MapProject[];
  onRemove?: (slug: string) => void;
}) {
  const strongest = strongestDevelopmentProfile(projects);

  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted">
        Select up to four sites to compare development profiles.
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs text-muted">{rankingExplanation()}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-4 font-medium">Field</th>
              {projects.map((project) => (
                <th key={project.slug} className="py-2 pr-4 font-medium text-ink">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/projects/${project.slug}`} className="hover:text-teal">
                      {project.name}
                    </Link>
                    {onRemove ? (
                      <button type="button" onClick={() => onRemove(project.slug)}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                  {project.archivedAt ? (
                    <span className="mt-1 inline-block rounded-sm bg-canvas px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                      Archived
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <CompareRow label="Location" values={projects.map((p) => locationLabel(p))} />
            <CompareRow label="Technology" values={projects.map((p) => p.technology)} />
            <CompareRow label="Import MW" values={projects.map((p) => `${p.importMW} MW`)} />
            <CompareRow label="Export MW" values={projects.map((p) => `${p.exportMW} MW`)} />
            <CompareRow
              label="Grid operator"
              values={projects.map((p) => p.gridOperator || "—")}
            />
            <CompareRow
              label="Team outlook"
              values={projects.map((p) => <OutlookBadge key={p.slug} outlook={p.outlook} />)}
            />
            <CompareRow
              label="Team confidence"
              values={projects.map((p) => (
                <ConfidenceBadge key={p.slug} confidence={p.confidence} />
              ))}
            />
            <CompareRow label="Connection stage" values={projects.map((p) => p.stage)} />
            <CompareRow
              label="Application readiness"
              values={projects.map((p) => readinessLabel(p.readinessPercent))}
            />
            <CompareRow label="Target COD" values={projects.map((p) => p.targetCOD || "—")} />
            <CompareRow
              label="Development profile score"
              values={projects.map((p) => `${p.developmentProfile.score} pts`)}
            />
            <CompareRow
              label="Open alerts"
              values={projects.map((p) => attentionLabel(p))}
            />
            <CompareRow
              label="Next connection milestone"
              values={projects.map((p) => milestoneLabel(p))}
            />
          </tbody>
        </table>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {projects.map((project) => {
          const explanation = buildDevelopmentProfileExplanation(
            {
              outlook: project.outlook,
              confidence: project.confidence,
              stage: project.stage,
              readinessPercent: project.readinessPercent,
              openCriticalAlerts: project.openAlerts.filter((alert) => alert.severity === "critical")
                .length,
              openWarningAlerts: project.openAlerts.filter((alert) => alert.severity === "warning")
                .length,
              connectionCaseStatus: project.connectionCase?.status ?? null,
            },
            {
              isHighestInComparison: strongest?.slug === project.slug,
              comparisonSize: projects.length,
            },
          );

          return (
            <div
              key={project.slug}
              className="rounded-md border border-line bg-canvas px-4 py-3 text-sm"
            >
              <p className="font-medium text-ink">{project.name}</p>
              <p className="mt-1 text-xs text-muted">
                Development profile · {project.developmentProfile.score} pts
              </p>
              <p className="mt-2 text-sm leading-6 text-ink">{explanation}</p>
              <ul className="mt-2 space-y-0.5 text-ink">
                {project.developmentProfile.factors.map((factor) => (
                  <li key={`${project.slug}-${factor.key}`} className="flex justify-between gap-2">
                    <span>{factor.label}</span>
                    <span className="shrink-0 font-mono text-xs text-muted">
                      {formatFactorPoints(factor.points)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {strongest ? (
        <div className="mt-4 rounded-md border border-line bg-teal-soft px-4 py-3 text-sm">
          <p className="font-medium text-teal">Strongest current development profile</p>
          <p className="mt-1 text-ink">
            {strongest.name} · {strongest.developmentProfile.score} pts
          </p>
          <p className="mt-2 text-sm leading-6 text-ink">
            {buildDevelopmentProfileExplanation(
              {
                outlook: strongest.outlook,
                confidence: strongest.confidence,
                stage: strongest.stage,
                readinessPercent: strongest.readinessPercent,
                openCriticalAlerts: strongest.openAlerts.filter(
                  (alert) => alert.severity === "critical",
                ).length,
                openWarningAlerts: strongest.openAlerts.filter(
                  (alert) => alert.severity === "warning",
                ).length,
                connectionCaseStatus: strongest.connectionCase?.status ?? null,
              },
              {
                isHighestInComparison: true,
                comparisonSize: projects.length,
              },
            )}
          </p>
          <p className="mt-2 text-xs text-muted">
            Stored project and workflow data only. Not a guarantee of connection or available
            capacity. This is not official grid intelligence.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function CompareRow({ label, values }: { label: string; values: ReactNode[] }) {
  return (
    <tr className="border-b border-line align-top">
      <td className={cn("py-2 pr-4 font-medium text-muted")}>{label}</td>
      {values.map((value, index) => (
        <td key={index} className="py-2 pr-4">
          {value}
        </td>
      ))}
    </tr>
  );
}
