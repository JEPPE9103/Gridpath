"use client";

import { Button } from "@/components/ui/button";
import type { OpportunityListItem } from "@/lib/data/opportunities";
import { opportunityRecommendationLabel, opportunityStatusLabel } from "@/lib/opportunities/catalog";
import { X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function MapOpportunityPanel({
  item,
  onClose,
}: {
  item: OpportunityListItem;
  onClose: () => void;
}) {
  const location = [item.municipality, item.region].filter(Boolean).join(", ") || item.country;
  return (
    <aside
      className="absolute inset-x-3 bottom-3 max-h-[58%] overflow-auto rounded-md border border-line bg-surface p-4 md:inset-x-auto md:bottom-auto md:right-3 md:top-3 md:max-h-[calc(100%-1.5rem)] md:w-[320px]"
      data-testid="map-opportunity-panel"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted">Opportunity · Customer entered</p>
          <h2 className="text-base font-semibold">{item.name}</h2>
          <p className="text-sm text-muted">{location}</p>
        </div>
        <button type="button" onClick={onClose} className="text-muted hover:text-ink" aria-label="Close opportunity panel">
          <X size={14} />
        </button>
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <Line label="Status" value={opportunityStatusLabel(item.status)} />
        <Line label="Recommendation" value={opportunityRecommendationLabel(item.recommendation)} />
        <Line label="Target MW" value={item.targetMw != null ? String(item.targetMw) : "—"} />
        <Line label="Area" value={item.contiguousAreaHa != null ? `${Math.round(item.contiguousAreaHa)} ha` : "Saved footprint where stored"} />
      </dl>
      <p className="mt-3 text-[11px] leading-4 text-muted">
        Saved development object. The polygon is the stored Opportunity footprint, not an official site boundary
        or available connection capacity.
      </p>
      <Link href={`/opportunities/${item.slug}`} className="mt-4 block" data-testid="map-open-opportunity">
        <Button className="w-full">Open Opportunity</Button>
      </Link>
    </aside>
  );
}

function Line({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
