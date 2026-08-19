"use client";

import { BellButton } from "@/components/layout/app-shell";
import { OutlookBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Disclaimer, EstimateNote } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tooltip } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast-provider";
import { formatHeaderDate, formatMWTotal, isAttentionOutlook } from "@/lib/format";
import { impactRepository, projectRepository } from "@/lib/repositories";
import { averageReadiness, countByOutlook, countByStage, kpis, mwByOperator } from "@/lib/stats";
import { useWorkspace } from "@/lib/workspace-state";
import { PIPELINE_STAGES, type Outlook } from "@/types";
import { FileBarChart, Sparkles } from "lucide-react";
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

export function ReportsPage() {
  const { overlays } = useWorkspace();
  const { pushToast } = useToast();
  const projects = useMemo(() => projectRepository.list(overlays), [overlays]);
  const metrics = kpis(projects);
  const impact = impactRepository.get();
  const stageData = PIPELINE_STAGES.map((stage) => ({
    stage,
    count: countByStage(projects)[stage],
  }));
  const outlookData = countByOutlook(projects);
  const operatorData = mwByOperator(projects);
  const attention = projects.filter((project) => isAttentionOutlook(project.outlook));
  const avgReady = averageReadiness(projects);

  function generate(name: string) {
    pushToast({
      title: "Report generated",
      description: `${name} prepared for download in this demo. No file is stored.`,
      tone: "success",
    });
  }

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Portfolio reporting for development and grid process review"
        actions={
          <>
            <BellButton />
            <span className="hidden text-sm text-muted sm:inline">{formatHeaderDate("2026-08-18")}</span>
          </>
        }
      />
      <div className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Stat label="Sites" value={metrics.activeSites} />
          <Stat label="Portfolio capacity" value={formatMWTotal(metrics.totalMW)} />
          <Stat label="Needs attention" value={metrics.needsAttention} />
          <Stat label="Avg. application readiness" value={`${avgReady}%`} />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Projects by stage">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={stageData} barSize={18}>
                <CartesianGrid stroke="#E3E1DD" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#5C6169" }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5C6169" }} />
                <RechartsTooltip />
                <Bar dataKey="count" fill="#2A7A6F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="MW by operator">
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

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">Projects by outlook</h2>
            <ul className="mt-3 space-y-2">
              {outlookData.map((row) => (
                <li key={row.outlook} className="flex items-center justify-between text-sm">
                  <OutlookBadge outlook={row.outlook as Outlook} />
                  <span className="font-mono">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">Projects requiring attention</h2>
            <ul className="mt-3 divide-y divide-line">
              {attention.map((project) => (
                <li key={project.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/projects/${project.id}`} className="font-medium hover:text-teal">
                    {project.name}
                  </Link>
                  <OutlookBadge outlook={project.outlook} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <ReportCard
            title="Portfolio Grid Development Report"
            body="Summary of sites, outlook, confidence and indicative capacity signals."
            onGenerate={() => generate("Portfolio Grid Development Report")}
          />
          <ReportCard
            title="Connection Pipeline"
            body="Cases by stage, deadlines and outstanding application items."
            onGenerate={() => generate("Connection Pipeline")}
          />
          <ReportCard
            title="Risk & Change Summary"
            body="External grid changes mapped to affected projects."
            onGenerate={() => generate("Risk & Change Summary")}
          />
        </section>

        <section className="rounded-md border border-line bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
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
            <Stat label="Sites deprioritised before detailed engineering" value={impact.sitesDeprioritised} />
            <Stat label="Projects monitored automatically" value={impact.projectsMonitored} />
            <Stat label="Grid / operator changes detected" value={impact.changesDetected} />
            <Stat label="Estimated engineering review hours avoided" value={impact.estimatedHoursAvoided} />
          </div>
          <Disclaimer className="mt-4" />
        </section>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <p className="font-mono text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
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

function ReportCard({
  title,
  body,
  onGenerate,
}: {
  title: string;
  body: string;
  onGenerate: () => void;
}) {
  return (
    <article className="rounded-md border border-line bg-surface p-5">
      <FileBarChart size={18} className="text-teal" />
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{body}</p>
      <Button className="mt-4" onClick={onGenerate}>
        Generate report
      </Button>
    </article>
  );
}
