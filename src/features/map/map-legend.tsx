"use client";

export const LOCAL_NETWORK_FILL = "#2A7A6F";
export const NUP_FILL = "#5B6B8C";

export function MapLegend() {
  return (
    <section className="rounded-md border border-line bg-surface/95 p-3 text-xs backdrop-blur-sm">
      <p className="font-medium">Legend</p>
      <div className="mt-2 space-y-2">
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted">Customer data</p>
        <LegendSwatch shape="dot" color="#176C4A" label="Project · Favourable" />
        <LegendSwatch shape="dot" color="#B54708" label="Project · Possible" />
        <LegendSwatch shape="dot" color="#B42318" label="Project · At Risk / Weak" />
        <LegendSwatch shape="dot" color="#8B9098" label="Project · Unknown" />
        <p className="pt-1 text-[10px] uppercase tracking-[0.12em] text-muted">Official source</p>
        <LegendSwatch shape="patch" color={LOCAL_NETWORK_FILL} label="Local network area · Ei" />
        <LegendSwatch shape="patch" color={NUP_FILL} label="Network development plan · Ei" />
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted">
        Team outlook colours are customer-entered triage, not available capacity.
      </p>
    </section>
  );
}

function LegendSwatch({
  shape,
  color,
  label,
}: {
  shape: "dot" | "patch";
  color: string;
  label: string;
}) {
  return (
    <p className="flex items-center gap-2">
      <span
        className={shape === "dot" ? "h-2.5 w-2.5 rounded-full" : "h-2.5 w-3.5 rounded-[2px]"}
        style={{
          background: shape === "dot" ? color : `${color}33`,
          boxShadow: shape === "patch" ? `inset 0 0 0 1px ${color}` : undefined,
        }}
      />
      {label}
    </p>
  );
}
