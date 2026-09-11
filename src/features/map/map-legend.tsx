"use client";

export const LOCAL_NETWORK_FILL = "#2A7A6F";
export const NUP_FILL = "#3D5278";

export function MapLegend({
  hasDiscoveryRun = false,
  showZones = false,
  showNup = false,
  showProjects = true,
  showOpportunities = true,
}: {
  hasDiscoveryRun?: boolean;
  showZones?: boolean;
  showNup?: boolean;
  showProjects?: boolean;
  showOpportunities?: boolean;
}) {
  return (
    <section className="w-[16.5rem] rounded-md border border-line bg-surface p-2.5 text-xs">
      <p className="font-medium">Legend</p>
      <div className="mt-2 space-y-1.5">
        {showProjects || showOpportunities ? (
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted">Your development</p>
        ) : null}
        {showProjects ? (
          <LegendSwatch shape="ring" color="#3F6E5A" label="Project · circle, outlook on the ring" />
        ) : null}
        {showOpportunities ? (
          <LegendSwatch shape="square" color="#2A7A6F" label="Opportunity · footprint + square" />
        ) : null}
        {hasDiscoveryRun ? (
          <>
            <p className="pt-1 text-[10px] uppercase tracking-[0.12em] text-muted">Discovery</p>
            <LegendSwatch shape="patch" color="#176C4A" label="Candidate Site" />
            <LegendSwatch shape="line" color="#1A1E24" label="Search Area" />
            {showZones ? (
              <LegendSwatch shape="patch" color="#C5CCD6" label="Opportunity Zone" />
            ) : null}
          </>
        ) : null}
        <p className="pt-1 text-[10px] uppercase tracking-[0.12em] text-muted">Official grid</p>
        <LegendSwatch shape="patch" color={LOCAL_NETWORK_FILL} label="Local network · covering" />
        {showNup ? (
          <LegendSwatch shape="patch" color={NUP_FILL} label="NUP · planning context" />
        ) : null}
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted">Covering ≠ capacity. Outlook is team triage.</p>
    </section>
  );
}

function LegendSwatch({
  shape,
  color,
  label,
}: {
  shape: "dot" | "patch" | "square" | "ring" | "line";
  color: string;
  label: string;
}) {
  return (
    <p className="flex items-center gap-2">
      <span
        className={
          shape === "dot"
            ? "h-2.5 w-2.5 rounded-full"
            : shape === "square"
              ? "h-2.5 w-2.5 rounded-[2px]"
              : shape === "ring"
                ? "h-2.5 w-2.5 rounded-full bg-canvas"
                : shape === "line"
                  ? "h-0 w-3.5 border-t border-dashed"
                  : "h-2.5 w-3.5 rounded-[2px]"
        }
        style={
          shape === "ring"
            ? { boxShadow: `inset 0 0 0 2px ${color}` }
            : shape === "line"
              ? { borderColor: color }
              : {
                  background: shape === "dot" || shape === "square" ? color : `${color}33`,
                  boxShadow: shape === "patch" ? `inset 0 0 0 1px ${color}` : undefined,
                }
        }
      />
      {label}
    </p>
  );
}
