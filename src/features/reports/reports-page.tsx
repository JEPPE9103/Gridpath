"use client";

import { BellButton } from "@/components/layout/app-shell";
import { OutlookBadge, StageBadge, StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { EmptyState, EmptyWorkspaceAction, ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DevelopmentFunnel } from "@/features/opportunities/development-funnel";
import {
  Metric,
  MetricStrip,
  PageBody,
  Panel,
  SectionHeader,
  TechnicalDetails,
  tableBodyRowClass,
  tableCellClass,
  tableHeadCellClass,
  tableHeadClass,
  tableWrapClass,
} from "@/components/ui/workspace";
import type { OpportunityFunnel } from "@/lib/data/opportunities";
import type {
  PortfolioReportResult,
  PortfolioReportViewModel,
  ReportExportRow,
} from "@/lib/data/report-types";
import { ClientHeaderDate } from "@/components/ui/client-header-date";
import { formatMWTotal } from "@/lib/format";
import type { ConnectionCaseStatus, Outlook } from "@/types";
import Link from "next/link";
import type { ReactNode } from "react";

export function ReportsPage({
  result,
  funnel,
}: {
  result: PortfolioReportResult;
  funnel: OpportunityFunnel;
}) {
  if (result.kind === "no_organization") {
    return (
      <>
        <PageHeader eyebrow="Monitor" title="Reports" subtitle="Portfolio reporting" />
        <PageBody>
          <EmptyState
            title="No workspace yet"
            description="This account is not a member of an organisation. Create or join a workspace to see portfolio reports."
            action={<EmptyWorkspaceAction />}
          />
        </PageBody>
      </>
    );
  }

  if (result.kind === "error") {
    return (
      <>
        <PageHeader eyebrow="Monitor" title="Reports" subtitle="Portfolio reporting" />
        <PageBody>
          <ErrorState
            title="Could not load reports"
            description="Try again in a moment. If the problem continues, sign in again."
          />
        </PageBody>
      </>
    );
  }

  return <LoadedReportsPage report={result.report} funnel={funnel} />;
}

function LoadedReportsPage({
  report,
  funnel,
}: {
  report: PortfolioReportViewModel;
  funnel: OpportunityFunnel;
}) {
  const { summary, readiness } = report;

  return (
    <>
      <PageHeader
        eyebrow="Monitor"
        title="Reports"
        subtitle={`${report.organizationName} · portfolio status, pipeline and workflow hygiene. Not connection feasibility.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => downloadPortfolioCsv(report.exportRows)}>
              Export CSV
            </Button>
            <BellButton />
            <ClientHeaderDate />
          </>
        }
      />
      <PageBody>
        <MetricStrip className="sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Projects" value={String(summary.projectCount)} />
          <Metric
            label="Requested MW"
            value={summary.portfolioMW > 0 ? formatMWTotal(summary.portfolioMW) : "Not set"}
            hint="Customer entered"
          />
          <Metric label="Action required" value={String(summary.needsAttention)} />
          <Metric label="Active connection cases" value={String(summary.activeConnectionCases)} />
        </MetricStrip>

        <DevelopmentFunnel funnel={funnel} />

        <section className="rounded-md border border-line bg-surface p-5">
          <SectionHeader
            title="Projects requiring attention"
            description="Overdue workflow items, overdue connection deadlines, or open alerts. Not a connection-risk score."
          />
          {report.attentionProjects.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No projects currently require attention.</p>
          ) : (
            <div className={`mt-4 ${tableWrapClass}`}>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className={tableHeadCellClass}>Project</th>
                    <th className={tableHeadCellClass}>Stage</th>
                    <th className={tableHeadCellClass}>Outlook</th>
                    <th className={tableHeadCellClass}>Readiness</th>
                    <th className={tableHeadCellClass}>Open alerts</th>
                    <th className={tableHeadCellClass}>Connection</th>
                    <th className={tableHeadCellClass}>Next milestone / deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {report.attentionProjects.map((project) => (
                    <tr key={project.slug} className={tableBodyRowClass}>
                      <td className={tableCellClass}>
                        <Link
                          href={`/projects/${project.slug}/connection`}
                          className="font-medium hover:text-teal"
                        >
                          {project.name}
                        </Link>
                      </td>
                      <td className={tableCellClass}>
                        <StageBadge stage={project.stage} />
                      </td>
                      <td className={tableCellClass}>
                        <OutlookBadge outlook={project.outlook} />
                      </td>
                      <td className={`${tableCellClass} tabular-nums`}>
                        {project.readinessPercent == null ? "Not available" : `${project.readinessPercent}%`}
                      </td>
                      <td className={`${tableCellClass} text-muted`}>
                        {alertSummary(project.openCriticalAlerts, project.openWarningAlerts)}
                      </td>
                      <td className={tableCellClass}>
                        {project.connectionStatus ? (
                          <StatusBadge status={project.connectionStatus as ConnectionCaseStatus} />
                        ) : (
                          <span className="text-muted">No case</span>
                        )}
                      </td>
                      <td className={`${tableCellClass} text-muted`}>
                        {milestoneDeadline(project.nextMilestone, project.deadline)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Panel>
            <h2 className="text-base font-semibold">Connection process</h2>
            <p className="mt-1 text-xs text-muted">Active cases only. Complete and cancelled are excluded.</p>
            <ul className="mt-3 space-y-2 text-sm">
              <CountLine
                label={<StatusBadge status="On Track" />}
                value={report.connectionHealth.onTrack}
              />
              <CountLine
                label={<StatusBadge status="Waiting" />}
                value={report.connectionHealth.waiting}
              />
              <CountLine
                label={<StatusBadge status="At Risk" />}
                value={report.connectionHealth.atRisk}
              />
              <CountLine
                label={<StatusBadge status="Overdue" />}
                value={report.connectionHealth.overdue}
              />
            </ul>
            <p className="mt-3 text-sm text-muted">
              {report.connectionHealth.upcomingDeadlines === 0
                ? "No active case deadlines in the next 14 days."
                : `${report.connectionHealth.upcomingDeadlines} upcoming deadline${report.connectionHealth.upcomingDeadlines === 1 ? "" : "s"} within 14 days.`}
            </p>
          </Panel>
          <Panel>
            <h2 className="text-base font-semibold">Workflow completeness</h2>
            <p className="mt-1 text-xs text-muted">
              Required items complete. Not connection probability, available capacity or feasibility.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <CountLine
                label="Portfolio average"
                value={
                  readiness.averagePercent == null ? "Not available" : `${readiness.averagePercent}%`
                }
              />
              <CountLine label="≥ 80%" value={readiness.atLeast80} />
              <CountLine label="50–79%" value={readiness.from50to79} />
              <CountLine label="< 50%" value={readiness.below50} />
            </ul>
            <p className="mt-3 text-sm text-muted">
              {readiness.notAvailable === 0
                ? `${readiness.scoredCount} projects have required requirements.`
                : `${readiness.notAvailable} project${readiness.notAvailable === 1 ? "" : "s"} with no required requirements — not available.`}
            </p>
          </Panel>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Panel>
            <h2 className="text-base font-semibold">Team outlook</h2>
            <p className="mt-1 text-xs text-muted">Customer-entered assessment — not live grid capacity.</p>
            <ul className="mt-3 space-y-2">
              {report.outlookCounts.map((row) => (
                <li key={row.label} className="flex items-center justify-between text-sm">
                  <OutlookBadge outlook={row.label as Outlook} />
                  <span className="tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <h2 className="text-base font-semibold">Technology mix</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {report.technologyMix.map((row) => (
                <li key={row.technology} className="flex items-center justify-between gap-3">
                  <span>{row.technology}</span>
                  <span className="tabular-nums text-muted">
                    {row.count}
                    {row.mw > 0 ? ` · ${formatMWTotal(row.mw)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <TechnicalDetails summary="Supporting counts">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-ink">Document status</p>
              <ul className="mt-2 space-y-1">
                <CountLine label="Complete" value={report.documentHealth.complete} />
                <CountLine label="In Progress" value={report.documentHealth.inProgress} />
                <CountLine label="Draft" value={report.documentHealth.draft} />
                <CountLine label="Missing" value={report.documentHealth.missing} />
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-ink">Workspace volume</p>
              <ul className="mt-2 space-y-1">
                <CountLine label="Open alerts" value={report.operational.openIssues} />
                <CountLine label="Requirements tracked" value={report.operational.requirementsTracked} />
                <CountLine label="Documents tracked" value={report.operational.documentsTracked} />
              </ul>
            </div>
          </div>
        </TechnicalDetails>

        <p className="text-xs leading-5 text-muted">
          Portfolio reporting uses project and workflow data stored in NOXHEIM. Official Ei Grid
          Intelligence is on each project Grid tab — it is not rolled into these KPIs as capacity
          or feasibility.
        </p>
      </PageBody>
    </>
  );
}

function alertSummary(critical: number, warning: number): string {
  if (critical === 0 && warning === 0) {
    return "None";
  }
  const parts: string[] = [];
  if (critical > 0) {
    parts.push(`${critical} critical`);
  }
  if (warning > 0) {
    parts.push(`${warning} warning`);
  }
  return parts.join(" · ");
}

function milestoneDeadline(milestone: string | null, deadline: string | null): string {
  const next = milestone?.trim() || "—";
  if (!deadline) {
    return next;
  }
  return `${next} · ${deadline}`;
}

function downloadPortfolioCsv(rows: ReportExportRow[]) {
  const headers = [
    "slug",
    "name",
    "location",
    "technology",
    "import_mw",
    "export_mw",
    "portfolio_mw",
    "grid_operator",
    "stage",
    "outlook",
    "confidence",
    "target_cod",
    "readiness",
    "connection_status",
    "next_milestone",
    "deadline",
  ] as const;

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.slug,
        row.name,
        row.location,
        row.technology,
        String(row.importMW),
        String(row.exportMW),
        String(row.portfolioMW),
        row.gridOperator,
        row.stage,
        row.outlook,
        row.confidence,
        row.targetCOD,
        row.readiness,
        row.connectionStatus,
        row.nextMilestone,
        row.deadline,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "noxheim-portfolio-report.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function CountLine({ label, value }: { label: ReactNode; value: string | number }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="tabular-nums text-muted">{value}</span>
    </li>
  );
}
