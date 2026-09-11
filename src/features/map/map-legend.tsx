"use client";

export const LOCAL_NETWORK_FILL = "#2A7A6F";
export const NUP_FILL = "#5B6B8C";

export function MapLegend({
  hasDiscoveryRun = false,
  showZones = false,
  showNup = false,
}: {
  hasDiscoveryRun?: boolean;
  showZones?: boolean;
  showNup?: boolean;
}) {
  return (
    <section className="rounded-md border border-line bg-surface/95 p-3 text-xs backdrop-blur-sm">
      <p className="font-medium">Legend</p>
      <div className="mt-2 space-y-2">
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted">Your development</p>
        <LegendSwatch shape="ring" color="#176C4A" label="Project · circle · team outlook on the ring" />
        <LegendSwatch shape="square" color="#2A7A6F" label="Opportunity · footprint + square" />
        {hasDiscoveryRun ? (
          <>
            <p className="pt-1 text-[10px] uppercase tracking-[0.12em] text-muted">Discovery</p>
            <LegendSwatch shape="patch" color="#176C4A" label="Candidate Site · screening geometry" />
            <LegendSwatch shape="line" color="#1A1E24" label="Search Area · contextual boundary" />
            {showZones ? (
              <LegendSwatch shape="patch" color="#C5CCD6" label="Opportunity Zone · remaining context" />
            ) : null}
          </>
        ) : null}
        <p className="pt-1 text-[10px] uppercase tracking-[0.12em] text-muted">Official source</p>
        <LegendSwatch shape="patch" color={LOCAL_NETWORK_FILL} label="Local network area · geographic covering" />
        {showNup ? (
          <LegendSwatch shape="patch" color={NUP_FILL} label="Network development plan · planning context" />
        ) : null}
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted">
        Official geographic covering is not available connection capacity. Team outlook is customer-entered
        triage, not an official site or capacity score.
      </p>
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
