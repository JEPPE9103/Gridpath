"use client";

import { BellButton } from "@/components/layout/app-shell";
import { OutlookBadge, StageBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import type {
  PortfolioReportResult,
  PortfolioReportViewModel,
  ReportExportRow,
} from "@/lib/data/report-types";
import { formatHeaderDate, formatMWTotal } from "@/lib/format";
import type { Outlook } from "@/types";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

export function ReportsPage({ result }: { result: PortfolioReportResult }) {
  if (result.kind === "no_organization") {
    return (
      <>
        <PageHeader title="Reports" subtitle="Portfolio reporting" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="No workspace yet"
            description="This account is not a member of an organisation. Create or join a workspace to see portfolio reports."
          />
        </div>
      </>
    );
  }

  if (result.kind === "error") {
    return (
      <>
        <PageHeader title="Reports" subtitle="Portfolio reporting" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="Could not load reports"
            description="Try again in a moment. If the problem continues, sign in again."
          />
        </div>
      </>
    );
  }

  return <LoadedReportsPage report={result.report} />;
}

function LoadedReportsPage({ report }: { report: PortfolioReportViewModel }) {
  const { summary, readiness } = report;
  const stageData = useMemo(
    () => report.stageCounts.map((row) => ({ stage: row.label, count: row.count })),
    [report.stageCounts],
  );
  const operatorData = useMemo(
    () => report.operatorMW.map((row) => ({ operator: row.operator, mw: row.mw })),
    [report.operatorMW],
  );

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={`${report.organizationName} · portfolio reporting for development and grid process review`}
        actions={
          <>
            <Button variant="secondary" onClick={() => downloadPortfolioCsv(report.exportRows)}>
              Export CSV
            </Button>
            <BellButton />
            <span className="hidden text-sm text-muted sm:inline">{formatHeaderDate()}</span>
          </>
        }
      />
      <div className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <Stat label="Projects" value={summary.projectCount} />
          <Stat label="Portfolio MW" value={formatMWTotal(summary.portfolioMW)} />
          <Stat label="Active connection cases" value={summary.activeConnectionCases} />
          <Stat label="Projects needing attention" value={summary.needsAttention} />
          <Stat label="Open alerts" value={summary.openAlerts} />
          <Stat
            label="Average application readiness"
            value={
              summary.averageReadinessPercent == null
                ? "Not available"
                : `${summary.averageReadinessPercent}%`
            }
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Projects by stage">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stageData} barSize={18}>
                <CartesianGrid stroke="#E3E1DD" vertical={false} />
                <XAxis
                  dataKey="stage"
                  tick={{ fontSize: 11, fill: "#5C6169" }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5C6169" }} />
                <RechartsTooltip />
                <Bar dataKey="count" fill="#2A7A6F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Portfolio MW by grid operator">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={operatorData} layout="vertical" barSize={14} margin={{ left: 16 }}>
                <CartesianGrid stroke="#E3E1DD" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#5C6169" }} />
                <YAxis
                  type="category"
                  dataKey="operator"
                  width={150}
                  tick={{ fontSize: 11, fill: "#5C6169" }}
                />
                <RechartsTooltip />
                <Bar dataKey="mw" fill="#1A1E24" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">Current project outlook</h2>
            <p className="mt-1 text-xs text-muted">Stored project assessment — not live grid capacity.</p>
            <ul className="mt-3 space-y-2">
              {report.outlookCounts.map((row) => (
                <li key={row.label} className="flex items-center justify-between text-sm">
                  <OutlookBadge outlook={row.label as Outlook} />
                  <span className="tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">Technology mix</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {report.technologyMix.map((row) => (
                <li key={row.technology} className="flex items-center justify-between gap-3">
                  <span>{row.technology}</span>
                  <span className="tabular-nums text-muted">
                    {row.count} · {formatMWTotal(row.mw)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">Connection health</h2>
            <p className="mt-1 text-xs text-muted">Active cases only. Complete and cancelled are excluded.</p>
            <ul className="mt-3 space-y-2 text-sm">
              <CountLine label="On Track" value={report.connectionHealth.onTrack} />
              <CountLine label="Waiting" value={report.connectionHealth.waiting} />
              <CountLine label="At Risk" value={report.connectionHealth.atRisk} />
              <CountLine label="Overdue" value={report.connectionHealth.overdue} />
            </ul>
            <p className="mt-3 text-sm text-muted">
              {report.connectionHealth.upcomingDeadlines === 0
                ? "No active case deadlines in the next 14 days."
                : `${report.connectionHealth.upcomingDeadlines} upcoming deadline${report.connectionHealth.upcomingDeadlines === 1 ? "" : "s"} within 14 days.`}
            </p>
          </div>
          <div className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">Application readiness</h2>
            <p className="mt-1 text-xs text-muted">
              Required requirements only. Same formula as Project Detail and Map.
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
          </div>
        </section>

        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Projects requiring attention</h2>
          <p className="mt-1 text-xs text-muted">
            Open critical or warning alerts, or connection cases that are at risk or overdue.
          </p>
          {report.attentionProjects.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No projects currently require attention.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-4 font-medium">Project</th>
                    <th className="py-2 pr-4 font-medium">Stage</th>
                    <th className="py-2 pr-4 font-medium">Outlook</th>
                    <th className="py-2 pr-4 font-medium">Readiness</th>
                    <th className="py-2 pr-4 font-medium">Open alerts</th>
                    <th className="py-2 pr-4 font-medium">Connection</th>
                    <th className="py-2 font-medium">Next milestone / deadline</th>
                  </tr>
                </thead>
                <tbody>
                  {report.attentionProjects.map((project) => (
                    <tr key={project.slug} className="border-b border-line align-top last:border-b-0">
                      <td className="py-2 pr-4">
                        <Link href={`/projects/${project.slug}`} className="font-medium hover:text-teal">
                          {project.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">
                        <StageBadge stage={project.stage} />
                      </td>
                      <td className="py-2 pr-4">
                        <OutlookBadge outlook={project.outlook} />
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        {project.readinessPercent == null ? "Not available" : `${project.readinessPercent}%`}
                      </td>
                      <td className="py-2 pr-4 text-muted">
                        {alertSummary(project.openCriticalAlerts, project.openWarningAlerts)}
                      </td>
                      <td className="py-2 pr-4">{project.connectionStatus ?? "No connection case"}</td>
                      <td className="py-2 text-muted">
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
          <div className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">Document health</h2>
            <p className="mt-1 text-xs text-muted">
              Document records stored in NOXHEIM. File storage is not connected.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <CountLine label="Complete" value={report.documentHealth.complete} />
              <CountLine label="In Progress" value={report.documentHealth.inProgress} />
              <CountLine label="Draft" value={report.documentHealth.draft} />
              <CountLine label="Missing" value={report.documentHealth.missing} />
            </ul>
          </div>
          <div className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">Operational activity</h2>
            <p className="mt-1 text-xs text-muted">Counts from current workspace records.</p>
            <ul className="mt-3 space-y-2 text-sm">
              <CountLine label="Projects monitored" value={report.operational.projectsMonitored} />
              <CountLine label="Open issues detected" value={report.operational.openIssues} />
              <CountLine
                label="Connection cases managed"
                value={report.operational.connectionCasesManaged}
              />
              <CountLine label="Requirements tracked" value={report.operational.requirementsTracked} />
              <CountLine label="Documents tracked" value={report.operational.documentsTracked} />
            </ul>
          </div>
        </section>

        <p className="text-xs leading-5 text-muted">
          Portfolio reporting is based on project and workflow data stored in NOXHEIM. Live external
          grid intelligence is not yet connected.
        </p>
      </div>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  );
}

function CountLine({ label, value }: { label: string; value: string | number }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="tabular-nums text-muted">{value}</span>
    </li>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-line bg-surface p-4 sm:p-5">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
