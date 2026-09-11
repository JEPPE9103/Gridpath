"use client";

import type { OfficialMapLayerVisibility } from "@/lib/domain/official-map";
import type { ReactNode } from "react";

export function MapLayerControl({
  layers,
  onChange,
  onCollapse,
  hasDiscoveryRun = false,
}: {
  layers: OfficialMapLayerVisibility;
  onChange: (next: OfficialMapLayerVisibility) => void;
  onCollapse?: () => void;
  hasDiscoveryRun?: boolean;
}) {
  return (
    <section className="w-[16.5rem] rounded-md border border-line bg-surface p-2.5 text-xs" data-testid="map-layers">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">Layers</p>
        {onCollapse ? (
          <button type="button" onClick={onCollapse} className="text-muted hover:text-ink" aria-label="Close layers">
            Close
          </button>
        ) : null}
      </div>
      <LayerGroup title="Your development">
        <LayerToggle
          checked={layers.projects}
          label="Projects"
          provenance="Customer entered"
          onChange={(checked) => onChange({ ...layers, projects: checked })}
        />
        <LayerToggle
          checked={layers.opportunities}
          label="Opportunities"
          provenance="Customer entered"
          onChange={(checked) => onChange({ ...layers, opportunities: checked })}
        />
        <LayerToggle
          checked={layers.rejectedOpportunities}
          label="Rejected opportunities"
          onChange={(checked) => onChange({ ...layers, rejectedOpportunities: checked })}
        />
      </LayerGroup>
      <LayerGroup title="Discovery">
        <LayerToggle
          checked={layers.searchAreas}
          disabled={!hasDiscoveryRun}
          label="Search Area"
          provenance={hasDiscoveryRun ? "Selected run" : "Select a run"}
          onChange={(checked) => onChange({ ...layers, searchAreas: checked })}
        />
        <LayerToggle
          checked={layers.candidateSites}
          disabled={!hasDiscoveryRun}
          label="Candidate Sites"
          provenance={hasDiscoveryRun ? "Noxheim Derived" : undefined}
          onChange={(checked) => onChange({ ...layers, candidateSites: checked })}
        />
        <LayerToggle
          checked={layers.opportunityZones}
          disabled={!hasDiscoveryRun}
          label="Opportunity Zones"
          testId="map-layer-opportunity-zones"
          onChange={(checked) => onChange({ ...layers, opportunityZones: checked })}
        />
      </LayerGroup>
      <LayerGroup title="Official grid" note="Covering geography, not available connection capacity.">
        <LayerToggle
          checked={layers.localNetwork}
          label="Local network areas"
          provenance="Official Source"
          testId="map-layer-local-network"
          onChange={(checked) => onChange({ ...layers, localNetwork: checked })}
        />
        <LayerToggle
          checked={layers.planningArea}
          label="Network development plans"
          provenance="Official Source"
          testId="map-layer-nup"
          onChange={(checked) => onChange({ ...layers, planningArea: checked })}
        />
      </LayerGroup>
    </section>
  );
}

function LayerGroup({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-2 border-t border-line pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</p>
      <div className="mt-1.5 space-y-1">{children}</div>
      {note ? <p className="mt-1.5 text-[11px] leading-4 text-muted">{note}</p> : null}
    </div>
  );
}

function LayerToggle({
  checked,
  label,
  provenance,
  onChange,
  disabled = false,
  testId,
}: {
  checked: boolean;
  label: string;
  provenance?: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <label className={`flex items-start gap-2 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 accent-teal"
        data-testid={testId}
      />
      <span>
        <span className="block text-sm leading-4">{label}</span>
        {provenance ? <span className="block text-[11px] leading-4 text-muted">{provenance}</span> : null}
      </span>
    </label>
  );
}
