import { AppFrame } from "@/components/marketing/app-frame";
import type { ReactNode } from "react";

export function ProductPreview() {
  return (
    <AppFrame path="/projects/sample-bess">
      <div className="grid min-h-[300px] bg-canvas sm:min-h-[400px] sm:grid-cols-[52px_1fr] md:grid-cols-[148px_1fr]">
        <aside className="hidden bg-sidebar px-2 py-4 text-white sm:block md:px-3">
          <p className="hidden px-1 text-[10px] font-semibold tracking-[0.16em] md:block">
            NOXHEIM
          </p>
          <p className="mt-6 hidden px-1 text-[9px] uppercase tracking-[0.14em] text-sidebar-muted md:block">
            Workspace
          </p>
          <div className="mt-2 space-y-1">
            <MiniNav label="Portfolio" active />
            <MiniNav label="Map & Compare" />
            <MiniNav label="Connections" />
            <MiniNav label="Changes" />
          </div>
        </aside>
        <div className="min-w-0 p-3 md:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-lg font-semibold leading-none">Sample Stockholm North BESS</p>
              <p className="mt-1 text-[11px] text-muted">Battery Storage · 40 / 40 MW · sample</p>
            </div>
            <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
              Sample
            </span>
          </div>
          <div className="mt-3 rounded-md border border-line bg-surface p-3 md:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Grid Intelligence</p>
              <p className="text-[10px] uppercase tracking-wide text-muted">Official source</p>
            </div>
            <dl className="mt-3 space-y-1.5 text-xs">
              <Row label="Official local-network context" value="Identified" />
              <Row label="Network development plan" value="Matched" />
              <Row label="Forecast need for transfer capacity" value="Published" />
              <Row label="Workflow readiness" value="7 of 10 required items" />
              <Row label="Team outlook" value="Customer-entered" />
            </dl>
            <p className="mt-3 text-[11px] leading-4 text-muted">
              Sample workspace. Forecast need for transfer capacity is not available MW or
              connection capacity.
            </p>
          </div>
        </div>
      </div>
    </AppFrame>
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

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
