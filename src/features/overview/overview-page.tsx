"use client";

import { BellButton } from "@/components/layout/app-shell";
import { CountBadge, OutlookBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { dismissOrganizationAlert } from "@/lib/alerts/actions";
import { cn } from "@/lib/cn";
import {
  OVERVIEW_PIPELINE_STAGES,
  type PortfolioOverview,
} from "@/lib/data/overview-types";
import { ClientHeaderDate } from "@/components/ui/client-header-date";
import {
  formatCapacityShort,
  formatMWTotal,
  formatRelative,
} from "@/lib/format";
import { type Alert, type Technology } from "@/types";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Hexagon,
  Info,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

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

export function OverviewPage({ overview }: { overview: PortfolioOverview }) {
  const router = useRouter();
  const [pendingAlertId, setPendingAlertId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [techFilter, setTechFilter] = useState<Technology | "All">("All");

  const { kpis, alerts, projects, recentProjects } = overview;
  const criticalCount = alerts.filter((alert) => alert.severity === "critical").length;
  const now = useMemo(() => new Date(), []);

  const technologies = useMemo(
    () => ["All", ...new Set(projects.map((project) => project.technology))] as const,
    [projects],
  );

  function onDismiss(alertId: string) {
    setPendingAlertId(alertId);
    startTransition(async () => {
      const result = await dismissOrganizationAlert(alertId);
      setPendingAlertId(null);
      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={
          overview.kind === "ok"
            ? `${overview.organizationName} · ${kpis.activeSites} sites · ${formatMWTotal(kpis.totalMW)} total`
            : "Workspace overview"
        }
        actions={
          <>
            <BellButton />
            <ClientHeaderDate />
          </>
        }
      />

      <div className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        {overview.kind === "no_organization" ? (
          <EmptyState
            title="No workspace yet"
            description="This account is not a member of an organisation. Create or join a workspace to see portfolio overview."
          />
        ) : overview.kind === "error" ? (
          <EmptyState
            title="Could not load overview"
            description="Portfolio data is temporarily unavailable. Try again in a moment."
          />
        ) : (
          <>
            <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Active Sites"
                value={kpis.activeSites}
                hint={`${formatMWTotal(kpis.totalMW)} total`}
                icon={Hexagon}
              />
              <KpiCard
                label="Connection Enquiries"
                value={kpis.connectionEnquiries}
                hint="Awaiting response"
                icon={Zap}
              />
              <KpiCard
                label="Grid Studies Open"
                value={kpis.gridStudiesOpen}
                hint="In progress"
                icon={Activity}
              />
              <KpiCard
                label="Needs Attention"
                value={kpis.needsAttention}
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
                    description="Open alerts for this workspace will appear here."
                  />
                </div>
              ) : (
                <ul>
                  {alerts.map((alert) => {
                    const style = SEVERITY_STYLES[alert.severity];
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
                          {alert.summary ? (
                            <p className="mt-0.5 text-sm text-ink/80">{alert.summary}</p>
                          ) : null}
                          {alert.detail ? (
                            <p className="mt-1 text-xs leading-5 text-muted">{alert.detail}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                            {alert.gridOperator ? <span>{alert.gridOperator}</span> : null}
                            {alert.projectSlug && alert.projectName ? (
                              <Link
                                href={`/projects/${alert.projectSlug}`}
                                className="rounded-full bg-surface px-2 py-0.5 font-medium text-ink hover:bg-white"
                              >
                                {alert.projectName}
                              </Link>
                            ) : null}
                            <span>{formatRelative(alert.detectedAt, now)}</span>
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
                            onClick={() => onDismiss(alert.id)}
                            disabled={isPending && pendingAlertId === alert.id}
                            className="rounded-md p-1 text-muted hover:bg-white hover:text-ink disabled:opacity-50"
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
                    ({projects.length} projects across {OVERVIEW_PIPELINE_STAGES.length} stages)
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
                {projects.length === 0 ? (
                  <EmptyState
                    title="No projects yet"
                    description="Projects in this organisation will appear on the pipeline."
                  />
                ) : (
                  <div className="flex min-w-[1100px] gap-3">
                    {OVERVIEW_PIPELINE_STAGES.map((stage, index) => {
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
                            {index < OVERVIEW_PIPELINE_STAGES.length - 1 ? (
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
                )}
              </div>
            </section>

            <section className="rounded-md border border-line bg-surface">
              <div className="border-b border-line px-5 py-3">
                <h2 className="text-base font-semibold">Recent project activity</h2>
              </div>
              {recentProjects.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    title="No recent project activity"
                    description="Updated projects in this organisation will appear here."
                  />
                </div>
              ) : (
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
                      {recentProjects.map((project) => (
                        <tr key={project.id} className="border-b border-line last:border-0">
                          <td className="px-5 py-2.5">
                            <Link
                              href={`/projects/${project.id}`}
                              className="font-medium hover:text-teal"
                            >
                              {project.name}
                            </Link>
                            <p className="text-xs text-muted">{project.location}</p>
                          </td>
                          <td className="px-5 py-2.5">{project.stage}</td>
                          <td className="px-5 py-2.5">
                            <OutlookBadge outlook={project.outlook} />
                          </td>
                          <td className="px-5 py-2.5 text-muted">
                            {formatRelative(project.lastUpdated, now)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
