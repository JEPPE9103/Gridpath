"use client";

import { AppFrame } from "@/components/marketing/app-frame";
import { DeferredMarketingMap } from "@/components/marketing/deferred-marketing-map";
import { StageBadge } from "@/components/ui/badges";
import {
  SAMPLE_PORTFOLIO_METRICS,
  SAMPLE_PORTFOLIO_PREVIEW_SITES,
  SAMPLE_SELECTED_PROJECT,
} from "@/lib/demo/sample-portfolio-preview";

export function ProductPreview() {
  return (
    <AppFrame path="/map">
      <div className="grid min-h-[280px] bg-canvas sm:min-h-[360px] sm:grid-cols-[52px_1fr] md:grid-cols-[148px_1fr]">
        <aside className="hidden bg-sidebar px-2 py-4 text-white sm:block md:px-3">
          <p className="hidden px-1 text-[10px] font-semibold tracking-[0.16em] md:block">
            NOXHEIM
          </p>
          <p className="mt-6 hidden px-1 text-[9px] uppercase tracking-[0.14em] text-sidebar-muted md:block">
            Workspace
          </p>
          <div className="mt-2 space-y-1">
            <MiniNav label="Portfolio" />
            <MiniNav label="Map & Compare" active />
            <MiniNav label="Connections" />
            <MiniNav label="Changes" />
          </div>
        </aside>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-3 py-2.5">
            <Metric label="Active sites" value={String(SAMPLE_PORTFOLIO_METRICS.sites)} />
            <Metric label="Portfolio" value={`${SAMPLE_PORTFOLIO_METRICS.megawatts} MW`} />
            <Metric
              label="Requiring attention"
              value={String(SAMPLE_PORTFOLIO_METRICS.requiringAttention)}
            />
          </div>
          <div className="relative">
            <DeferredMarketingMap
              eager
              selectedId={SAMPLE_SELECTED_PROJECT.id}
              sites={SAMPLE_PORTFOLIO_PREVIEW_SITES}
              size="hero"
            />
            <div className="p-3 sm:absolute sm:bottom-3 sm:left-3 sm:w-[248px] sm:p-0">
              <SelectedProjectCard />
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}

function SelectedProjectCard() {
  const project = SAMPLE_SELECTED_PROJECT;
  const readiness = Math.round(
    (project.readinessComplete / project.readinessRequired) * 100,
  );

  return (
    <article className="rounded-md border border-line bg-surface p-3 shadow-[0_16px_32px_-24px_rgba(26,30,36,0.55)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold leading-5">{project.name}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {project.location} · {project.mw}
          </p>
        </div>
        <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
          Sample
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StageBadge stage={project.stage} />
        <span className="text-[11px] text-muted">{readiness}% readiness</span>
      </div>
      <dl className="mt-3 space-y-1 text-[11px]">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Official local-network</dt>
          <dd className="font-medium">{project.localNetwork}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Source</dt>
          <dd className="font-medium">{project.source}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Grid Study</dt>
          <dd className="font-medium">{project.stage}</dd>
        </div>
      </dl>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[11px] text-muted">
      <span className="font-semibold text-ink">{value}</span> {label}
    </p>
  );
}

function MiniNav({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div
      className={
        active
          ? "relative rounded-md bg-sidebar-hover px-2 py-1.5 text-[11px] text-white"
          : "hidden rounded-md px-2 py-1.5 text-[11px] text-sidebar-muted md:block"
      }
    >
      {active ? (
        <span className="absolute top-1 bottom-1 left-0 w-[2px] rounded-r bg-teal" />
      ) : null}
      <span className={active ? "text-teal md:text-white" : undefined}>{label}</span>
    </div>
  );
}
