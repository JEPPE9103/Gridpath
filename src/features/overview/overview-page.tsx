"use client";

import { BellButton } from "@/components/layout/app-shell";
import { CountBadge, OutlookBadge } from "@/components/ui/badges";
import { Disclaimer, EmptyState, EstimateNote } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import {
  formatCapacityShort,
  formatHeaderDate,
  formatMWTotal,
  formatRelative,
} from "@/lib/format";
import { alertRepository, impactRepository, projectRepository } from "@/lib/repositories";
import { kpis } from "@/lib/stats";
import { useWorkspace } from "@/lib/workspace-state";
import { PIPELINE_STAGES, type Alert, type Technology } from "@/types";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Hexagon,
  Info,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const SEVERITY_STYLES: Record<
  Alert["severity"],
  { wrap: string; icon: string; Icon: typeof AlertTriangle }
> = {
  critical: {
    wrap: "border-l-critical bg-critical-bg/60",
    icon: "text-critical",
    Icon: AlertTriangle,
  },
  warning: {
    wrap: "border-l-warning bg-warning-bg/70",
    icon: "text-warning",
    Icon: AlertTriangle,
  },
  info: {
    wrap: "border-l-info bg-info-bg/70",
    icon: "text-info",
    Icon: Info,
  },
  positive: {
    wrap: "border-l-success bg-success-bg/70",
    icon: "text-success",
    Icon: CheckCircle2,
  },
};

export function OverviewPage() {
  const { overlays, dismissAlert } = useWorkspace();
  const projects = useMemo(() => projectRepository.list(overlays), [overlays]);
  const alerts = useMemo(() => alertRepository.list(overlays), [overlays]);
  const metrics = kpis(projects);
  const impact = impactRepository.get();
  const [techFilter, setTechFilter] = useState<Technology | "All">("All");

  const criticalCount = alerts.filter((alert) => alert.severity === "critical").length;
  const recent = [...projects]
    .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 6);

  const technologies = useMemo(
    () => ["All", ...new Set(projects.map((project) => project.technology))] as const,
    [projects],
  );

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={`Sweden portfolio · ${metrics.activeSites} sites · ${formatMWTotal(metrics.totalMW)} total`}
        actions={
          <>
            <BellButton />
            <span className="hidden text-sm text-muted sm:inline">{formatHeaderDate("2026-08-18")}</span>
          </>
        }
      />

      <div className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Active Sites"
            value={metrics.activeSites}
            hint={`${formatMWTotal(metrics.totalMW)} total`}
            icon={Hexagon}
          />
          <KpiCard
            label="Connection Enquiries"
            value={metrics.connectionEnquiries}
            hint="Awaiting response"
            icon={Zap}
          />
          <KpiCard
            label="Grid Studies Open"
            value={metrics.gridStudiesOpen}
            hint="In progress"
            icon={Activity}
          />
          <KpiCard
            label="Needs Attention"
            value={metrics.needsAttention}
            hint="Deadline or data issue"
            icon={AlertTriangle}
            tone="critical"
          />
        </section>

        <section className="rounded-md border border-line bg-surface">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">Active Alerts</h2>
              <CountBadge tone="critical">{criticalCount} critical</CountBadge>
              <CountBadge>{alerts.length} total</CountBadge>
            </div>
          </div>

          {alerts.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No active alerts"
                description="Dismissed alerts stay hidden in this browser. Reload the demo data by clearing local storage if you want them back."
              />
            </div>
          ) : (
            <ul>
              {alerts.map((alert) => {
                const style = SEVERITY_STYLES[alert.severity];
                const project = projects.find((item) => item.id === alert.projectId);
                const Icon = style.Icon;
                return (
                  <li
                    key={alert.id}
                    className={cn(
                      "flex items-start gap-3 border-b border-line border-l-4 px-5 py-3.5 last:border-b-0",
                      style.wrap,
                    )}
                  >
                    <Icon size={16} className={cn("mt-0.5 shrink-0", style.icon)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{alert.title}</p>
                      <p className="mt-0.5 text-sm text-ink/80">{alert.summary}</p>
                      <p className="mt-1 text-xs leading-5 text-muted">{alert.detail}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                        {alert.operator ? <span>{alert.operator}</span> : null}
                        {project ? (
                          <Link
                            href={`/projects/${project.id}`}
                            className="rounded-full bg-surface px-2 py-0.5 font-medium text-ink hover:bg-white"
                          >
                            {project.name}
                          </Link>
                        ) : null}
                        <span>{formatRelative(alert.timestamp)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Link
                        href={alert.href}
                        className="inline-flex items-center gap-1 text-sm font-medium text-teal hover:underline"
                      >
                        {alert.ctaLabel} <ArrowRight size={14} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => dismissAlert(alert.id)}
                        className="rounded-md p-1 text-muted hover:bg-white hover:text-ink"
                        aria-label="Dismiss alert"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
            <h2 className="text-base font-semibold">
              Development Pipeline{" "}
              <span className="font-normal text-muted">
                ({projects.length} projects across {PIPELINE_STAGES.length} stages)
              </span>
            </h2>
            <label className="flex items-center gap-2 text-sm text-muted">
              Filter
              <select
                value={techFilter}
                onChange={(event) => setTechFilter(event.target.value as Technology | "All")}
                className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
              >
                {technologies.map((tech) => (
                  <option key={tech} value={tech}>
                    {tech}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="overflow-x-auto px-5 py-4">
            <div className="flex min-w-[1100px] gap-3">
              {PIPELINE_STAGES.map((stage, index) => {
                const cards = projects.filter(
                  (project) =>
                    project.stage === stage &&
                    (techFilter === "All" || project.technology === techFilter),
                );
                return (
                  <div key={stage} className="flex min-w-[150px] flex-1 flex-col">
                    <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted">
                      <span>
                        {stage} ({cards.length})
                      </span>
                      {index < PIPELINE_STAGES.length - 1 ? (
                        <ArrowRight size={12} className="text-line" />
                      ) : null}
                    </div>
                    <div className="space-y-2">
                      {cards.map((project) => (
                        <Link
                          key={project.id}
                          href={`/projects/${project.id}`}
                          className="block rounded-md border border-line bg-canvas px-3 py-2 hover:border-teal"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-5">{project.name}</p>
                            <OutlookBadge outlook={project.outlook} />
                          </div>
                          <p className="mt-1 font-mono text-[11px] text-muted">
                            {formatCapacityShort(project)}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-md border border-line bg-surface">
          <div className="border-b border-line px-5 py-3">
            <h2 className="text-base font-semibold">Recent project activity</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-2 font-medium">Project</th>
                  <th className="px-5 py-2 font-medium">Stage</th>
                  <th className="px-5 py-2 font-medium">Outlook</th>
                  <th className="px-5 py-2 font-medium">Last update</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((project) => (
                  <tr key={project.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-2.5">
                      <Link href={`/projects/${project.id}`} className="font-medium hover:text-teal">
                        {project.name}
                      </Link>
                      <p className="text-xs text-muted">{project.location}</p>
                    </td>
                    <td className="px-5 py-2.5">{project.stage}</td>
                    <td className="px-5 py-2.5">
                      <OutlookBadge outlook={project.outlook} />
                    </td>
                    <td className="px-5 py-2.5 text-muted">
                      {formatRelative(project.lastUpdated)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-md border border-line bg-surface p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Development impact</h2>
              <EstimateNote className="mt-1" />
            </div>
            <Tooltip content="Estimates use customer-defined assumptions and workflow activity.">
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <Sparkles size={12} /> Estimated
              </span>
            </Tooltip>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <ImpactStat label="Sites deprioritised before detailed engineering" value={impact.sitesDeprioritised} />
            <ImpactStat label="Projects monitored automatically" value={impact.projectsMonitored} />
            <ImpactStat label="Grid / operator changes detected" value={impact.changesDetected} />
            <ImpactStat label="Estimated engineering review hours avoided" value={impact.estimatedHoursAvoided} />
          </div>
          <Disclaimer className="mt-4" />
        </section>
      </div>
    </>
  );
}

function ImpactStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-3">
      <p className="font-mono text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs leading-4 text-muted">{label}</p>
    </div>
  );
}
