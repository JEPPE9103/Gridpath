import { AppFrame } from "@/components/marketing/app-frame";
import { CountBadge, OutlookBadge } from "@/components/ui/badges";
import { formatCapacityShort, formatMWTotal } from "@/lib/format";
import { projectRepository } from "@/lib/repositories";
import { kpis } from "@/lib/stats";
import { AlertTriangle, Hexagon, Zap } from "lucide-react";

const projects = projectRepository.list();
const metrics = kpis(projects);

const ALERTS = [
  {
    title: "Grid capacity data updated — Indicative headroom reduced",
    meta: "Vattenfall Eldistribution · Gävle BESS",
    tone: "critical" as const,
  },
  {
    title: "Connection application deadline in 18 days",
    meta: "Svenska kraftnät · Uppsala Wind North",
    tone: "critical" as const,
  },
  {
    title: "Capacity outlook improved for Falun BESS",
    meta: "Vattenfall Eldistribution · Falun BESS",
    tone: "positive" as const,
  },
];

export function ProductPreview() {
  return (
    <AppFrame>
      <div className="grid min-h-[420px] grid-cols-[52px_1fr] bg-canvas md:grid-cols-[148px_1fr]">
        <aside className="bg-sidebar px-2 py-4 text-white md:px-3">
          <p className="hidden px-1 text-[10px] font-semibold tracking-[0.16em] md:block">
            NOXHEIM
          </p>
          <p className="mt-6 hidden px-1 text-[9px] uppercase tracking-[0.14em] text-sidebar-muted md:block">
            Workspace
          </p>
          <div className="mt-2 space-y-1">
            <MiniNav label="Overview" active />
            <MiniNav label="Portfolio" />
            <MiniNav label="Map & Compare" />
            <MiniNav label="Changes" />
          </div>
        </aside>
        <div className="min-w-0 p-3 md:p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-lg font-semibold leading-none">Overview</p>
              <p className="mt-1 text-[11px] text-muted">
                Sweden portfolio · {metrics.activeSites} sites · {formatMWTotal(metrics.totalMW)}{" "}
                total
              </p>
            </div>
            <span className="hidden text-[11px] text-muted sm:inline">18 Aug 2026</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <MiniKpi label="Active Sites" value={metrics.activeSites} icon={Hexagon} />
            <MiniKpi label="Enquiries" value={metrics.connectionEnquiries} icon={Zap} />
            <MiniKpi label="Grid Studies" value={metrics.gridStudiesOpen} icon={Hexagon} />
            <MiniKpi
              label="Needs Attention"
              value={metrics.needsAttention}
              icon={AlertTriangle}
              critical
            />
          </div>
          <div className="mt-3 rounded-md border border-line bg-surface">
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <p className="text-xs font-semibold">Active Alerts</p>
              <CountBadge tone="critical">2 critical</CountBadge>
            </div>
            <ul>
              {ALERTS.map((alert) => (
                <li
                  key={alert.title}
                  className={
                    alert.tone === "critical"
                      ? "border-l-4 border-l-critical border-b border-b-line bg-critical-bg/50 px-3 py-2 last:border-b-0"
                      : "border-l-4 border-l-success border-b border-b-line bg-success-bg/50 px-3 py-2 last:border-b-0"
                  }
                >
                  <p className="text-[12px] font-medium leading-4">{alert.title}</p>
                  <p className="mt-0.5 text-[10px] text-muted">{alert.meta}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 hidden gap-2 sm:grid sm:grid-cols-4">
            {projects.slice(0, 4).map((project) => (
              <div key={project.id} className="rounded-md border border-line bg-surface px-2.5 py-2">
                <p className="truncate text-[11px] font-medium">{project.name}</p>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <span className="font-mono text-[10px] text-muted">
                    {formatCapacityShort(project)}
                  </span>
                  <OutlookBadge outlook={project.outlook} />
                </div>
              </div>
            ))}
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

function MiniKpi({
  label,
  value,
  icon: Icon,
  critical = false,
}: {
  label: string;
  value: number;
  icon: typeof Hexagon;
  critical?: boolean;
}) {
  return (
    <div className="rounded-md border border-line bg-surface px-2.5 py-2">
      <div className="flex items-center justify-between">
        <p className="text-[9px] uppercase tracking-wide text-muted">{label}</p>
        <Icon size={12} className={critical ? "marketing-pulse text-critical" : "text-teal"} />
      </div>
      <p className="mt-1 font-mono text-lg font-semibold leading-none">{value}</p>
    </div>
  );
}
