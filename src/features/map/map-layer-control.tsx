"use client";

import type { OfficialMapLayerVisibility } from "@/lib/domain/official-map";
import { ChevronLeft } from "lucide-react";
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
    <section className="rounded-md border border-line bg-surface/95 p-3 text-xs backdrop-blur-sm" data-testid="map-layers">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">Map layers</p>
          <p className="mt-0.5 text-[11px] leading-4 text-muted">Development objects above official covering</p>
        </div>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            className="text-muted hover:text-ink"
            aria-label="Collapse map layers"
          >
            <ChevronLeft size={14} />
          </button>
        ) : null}
      </div>
      <LayerGroup title="Your development" subtitle="Customer entered">
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
      </LayerGroup>
      <LayerGroup title="Discovery" subtitle={hasDiscoveryRun ? "Selected run · Noxheim Derived" : "Select a run to load"}>
        <LayerToggle
          checked={layers.searchAreas}
          disabled={!hasDiscoveryRun}
          label="Search Area"
          onChange={(checked) => onChange({ ...layers, searchAreas: checked })}
        />
        <LayerToggle
          checked={layers.candidateSites}
          disabled={!hasDiscoveryRun}
          label="Candidate Sites"
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
      <LayerGroup title="Official grid" subtitle="Grid Intelligence · covering geography, not capacity">
        <LayerToggle
          checked={layers.localNetwork}
          label="Local network areas"
          testId="map-layer-local-network"
          onChange={(checked) => onChange({ ...layers, localNetwork: checked })}
        />
        <LayerToggle
          checked={layers.planningArea}
          label="Network development plans"
          testId="map-layer-nup"
          onChange={(checked) => onChange({ ...layers, planningArea: checked })}
        />
      </LayerGroup>
    </section>
  );
}

function LayerGroup({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-2 border-t border-line pt-2">
      <p className="font-medium text-ink">{title}</p>
      <p className="mb-1.5 text-[11px] leading-4 text-muted">{subtitle}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function LayerToggle({
  checked,
  label,
  onChange,
  disabled = false,
  testId,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <label className={`flex items-center gap-2 text-sm ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-teal"
        data-testid={testId}
      />
      {label}
    </label>
  );
}
