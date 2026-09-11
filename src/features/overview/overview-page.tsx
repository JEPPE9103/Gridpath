"use client";

import { BellButton } from "@/components/layout/app-shell";
import { CountBadge, OutlookBadge } from "@/components/ui/badges";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState, EmptyWorkspaceAction, ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Metric, MetricStrip, PageBody, Panel, SectionHeader } from "@/components/ui/workspace";
import { dismissOrganizationAlert } from "@/lib/alerts/actions";
import { cn } from "@/lib/cn";
import {
  OVERVIEW_PIPELINE_STAGES,
  type OverviewAlertItem,
  type OverviewProject,
  type PortfolioOverview,
} from "@/lib/data/overview-types";
import { PortfolioAttentionSection } from "@/features/overview/portfolio-attention-section";
import { DevelopmentFunnel } from "@/features/opportunities/development-funnel";
import type { OpportunityFunnel } from "@/lib/data/opportunities";
import { OfficialChangesSignal } from "@/features/changes/official-changes-signal";
import { formatMWTotal, formatRelative } from "@/lib/format";
import {
  EMPTY_OVERVIEW_DESCRIPTION,
  EMPTY_OVERVIEW_TITLE,
} from "@/lib/opportunities/evidence-coverage";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const SEVERITY_STYLES: Record<
  OverviewAlertItem["severity"],
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

const MAX_ALERT_ROWS = 3;

export function OverviewPage({
  overview,
  funnel,
}: {
  overview: PortfolioOverview;
  funnel: OpportunityFunnel;
}) {
  const router = useRouter();
  const [pendingAlertId, setPendingAlertId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { kpis, alerts, projects, recentProjects, portfolioAttention } = overview;
  const criticalCount = alerts.filter((alert) => alert.severity === "critical").length;
  const now = useMemo(() => new Date(), []);
  const visibleAlerts = alerts.slice(0, MAX_ALERT_ROWS);
  const emptyWorkspace = funnel.total === 0 && kpis.activeSites === 0 && funnel.searches === 0;

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
        eyebrow="Command"
        title="Overview"
        subtitle={
          overview.kind === "ok"
            ? `${overview.organizationName} · what needs attention, what changed, what to do next`
            : "Development command center for this workspace"
        }
        actions={<BellButton />}
      />

      <PageBody>
        {overview.kind === "no_organization" ? (
          <EmptyState
            title="No workspace yet"
            description="This account is not a member of an organisation. Create or join a workspace to see what to do next."
            action={<EmptyWorkspaceAction />}
          />
        ) : overview.kind === "error" ? (
          <ErrorState
            title="Could not load overview"
            description="Portfolio data is temporarily unavailable. Try again in a moment. If it continues, sign in again."
          />
        ) : emptyWorkspace ? (
          <EmptyState
            title={EMPTY_OVERVIEW_TITLE}
            description={EMPTY_OVERVIEW_DESCRIPTION}
            action={
              <Link href="/opportunities/new" className={buttonClassName()}>
                New search
              </Link>
            }
          />
        ) : (
          <>
            <MetricStrip>
              <Metric
                label="Action required"
                value={String(portfolioAttention.actionRequiredCount)}
                tone={portfolioAttention.actionRequiredCount > 0 ? "critical" : undefined}
              />
              <Metric
                label="Watch"
                value={String(portfolioAttention.upcomingCount)}
                tone={portfolioAttention.upcomingCount > 0 ? "warning" : undefined}
              />
              <Metric
                label="Official changes"
                value={String(overview.officialChanges.unreviewed)}
                href="/changes"
                hint="To review"
              />
              <Metric label="Open alerts" value={String(alerts.length)} href="/alerts" />
            </MetricStrip>

            <p className="text-xs text-muted">
              {kpis.activeSites} active sites ·{" "}
              {kpis.totalMW > 0 ? `${formatMWTotal(kpis.totalMW)} requested` : "requested MW not set"}{" "}
              (customer-entered)
              {kpis.connectionEnquiries > 0 ? ` · ${kpis.connectionEnquiries} connection enquiries` : ""}
              {kpis.gridStudiesOpen > 0 ? ` · ${kpis.gridStudiesOpen} grid studies open` : ""}
            </p>

            <DevelopmentFunnel funnel={funnel} />

            <PortfolioAttentionSection
              attention={portfolioAttention}
              activeCount={kpis.activeSites}
              officialChangesToReview={overview.officialChanges.unreviewed}
              sourceDelayMessage={overview.officialSourceDelayMessage}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <OfficialChangesSignal
                counts={overview.officialChanges}
                href="/changes"
                sourceDelayMessage={overview.officialSourceDelayMessage}
              />

              <Panel padded={false}>
                <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
                  <h2 className="text-base font-semibold">Open alerts</h2>
                  {criticalCount > 0 ? (
                    <CountBadge tone="critical">{criticalCount} critical</CountBadge>
                  ) : null}
                  <Link href="/alerts" className="ml-auto text-sm font-medium text-teal hover:underline">
                    View all
                  </Link>
                </div>
                {alerts.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-muted">No open alerts.</p>
                ) : (
                  <ul>
                    {visibleAlerts.map((alert) => {
                      const style = SEVERITY_STYLES[alert.severity];
                      const Icon = style.Icon;
                      return (
                        <li
                          key={alert.id}
                          className={cn(
                            "flex items-start gap-3 border-b border-line border-l-4 px-5 py-3 last:border-b-0",
                            style.wrap,
                          )}
                        >
                          <Icon size={16} className={cn("mt-0.5 shrink-0", style.icon)} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-ink">{alert.title}</p>
                            {alert.summary ? (
                              <p className="mt-0.5 text-sm text-muted">{alert.summary}</p>
                            ) : null}
                            <p className="mt-1 text-xs text-muted">
                              {alert.projectName ? `${alert.projectName} · ` : ""}
                              {formatRelative(alert.detectedAt, now)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Link
                              href={alert.href}
                              className="text-sm font-medium text-teal hover:underline"
                            >
                              {alert.ctaLabel}
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
              </Panel>
            </div>

            <PipelineStrip projects={projects} />

            <section>
              <SectionHeader
                title="Recently updated"
                action={
                  <Link href="/portfolio" className="text-sm font-medium text-teal hover:underline">
                    Portfolio
                  </Link>
                }
              />
              {recentProjects.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Updated projects will appear here.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
                  {recentProjects.slice(0, 5).map((project) => (
                    <li key={project.id}>
                      <Link
                        href={`/projects/${project.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-canvas"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-ink">{project.name}</p>
                          <p className="text-xs text-muted">
                            {project.stage} · {project.location}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <OutlookBadge outlook={project.outlook} />
                          <span className="text-xs text-muted">
                            {formatRelative(project.lastUpdated, now)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </PageBody>
    </>
  );
}

function PipelineStrip({ projects }: { projects: OverviewProject[] }) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <section>
      <SectionHeader
        title="Development pipeline"
        action={
          <Link href="/portfolio" className="text-sm font-medium text-teal hover:underline">
            Open Portfolio
          </Link>
        }
      />
      <div className="mt-3 flex overflow-x-auto rounded-md border border-line bg-surface">
        {OVERVIEW_PIPELINE_STAGES.map((stage, index) => {
          const count = projects.filter((project) => project.stage === stage).length;
          return (
            <Link
              key={stage}
              href={`/portfolio?stage=${encodeURIComponent(stage)}`}
              className={cn(
                "min-w-[6.75rem] flex-1 px-3 py-2.5 hover:bg-canvas",
                index < OVERVIEW_PIPELINE_STAGES.length - 1 && "border-r border-line",
              )}
            >
              <p className="text-[10px] tabular-nums text-muted">{index + 1}</p>
              <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">{stage}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{count}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
