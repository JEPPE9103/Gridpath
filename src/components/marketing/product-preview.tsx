import { AppFrame } from "@/components/marketing/app-frame";
import { SourceBadge } from "@/components/ui/badges";
import type { ReactNode } from "react";

export function ProductPreview() {
  return (
    <AppFrame path="/projects/gavle-bess">
      <div className="grid min-h-[300px] bg-canvas sm:min-h-[400px] sm:grid-cols-[52px_1fr] md:grid-cols-[148px_1fr]">
        <aside className="hidden bg-sidebar px-2 py-4 text-white sm:block md:px-3">
          <p className="hidden px-1 text-[10px] font-semibold tracking-[0.16em] md:block">
            NOXHEIM
          </p>
          <p className="mt-6 hidden px-1 text-[9px] uppercase tracking-[0.14em] text-sidebar-muted md:block">
            Workspace
          </p>
          <div className="mt-2 space-y-1">
            <MiniNav label="Overview" />
            <MiniNav label="Portfolio" active />
            <MiniNav label="Map & Compare" />
            <MiniNav label="Changes" />
          </div>
        </aside>
        <div className="min-w-0 p-3 md:p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-lg font-semibold leading-none">Gävle BESS</p>
              <p className="mt-1 text-[11px] text-muted">Battery Storage · 20 / 20 MW · Gävle</p>
            </div>
            <SourceBadge source="Official" />
          </div>
          <div className="mt-3 rounded-md border border-line bg-surface p-3 md:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Official network development plan</p>
              <p className="text-[10px] uppercase tracking-wide text-muted">
                Energimarknadsinspektionen
              </p>
            </div>
            <dl className="mt-3 space-y-1.5 text-xs">
              <Row label="Workspace operator" value="Vattenfall Eldistribution" />
              <Row label="Official local network" value="Gävle Energi Elnät AB" />
              <Row label="Official NUP company" value="Gävle Energi Elnät AB" />
              <Row label="Forecast need 2028" value="139.7 MW" />
              <Row label="Planned investments" value="Ja" />
              <Row label="Overlying-network limitation" value="Ja" />
            </dl>
            <p className="mt-3 text-[11px] leading-4 text-muted">
              Forecast need for transfer capacity. Not available MW, headroom, or connection
              capacity.
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
