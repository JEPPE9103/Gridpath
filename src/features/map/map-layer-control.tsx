"use client";

import type { OfficialMapLayerVisibility } from "@/lib/domain/official-map";

export function MapLayerControl({
  layers,
  onChange,
}: {
  layers: OfficialMapLayerVisibility;
  onChange: (next: OfficialMapLayerVisibility) => void;
}) {
  return (
    <section className="rounded-md border border-line bg-surface/95 p-3 text-xs backdrop-blur-sm">
      <p className="font-medium">Grid Intelligence</p>
      <p className="mt-0.5 text-[11px] leading-4 text-muted">Official Ei geography · not capacity</p>
      <div className="mt-2 space-y-1.5">
        <LayerToggle
          checked={layers.projects}
          label="Projects"
          onChange={(checked) => onChange({ ...layers, projects: checked })}
        />
        <LayerToggle
          checked={layers.opportunities}
          label="Opportunities"
          onChange={(checked) => onChange({ ...layers, opportunities: checked })}
        />
        <LayerToggle
          checked={layers.rejectedOpportunities}
          label="Rejected opportunities"
          onChange={(checked) => onChange({ ...layers, rejectedOpportunities: checked })}
        />
        <LayerToggle
          checked={layers.localNetwork}
          label="Local network areas"
          onChange={(checked) => onChange({ ...layers, localNetwork: checked })}
        />
        <LayerToggle
          checked={layers.planningArea}
          label="Network development plans"
          onChange={(checked) => onChange({ ...layers, planningArea: checked })}
        />
      </div>
    </section>
  );
}

function LayerToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-teal"
      />
      {label}
    </label>
  );
}
