"use client";

import { Button } from "@/components/ui/button";
import { MapFact, MapObjectPanel, MapPanelNote } from "@/features/map/map-object-panel";
import type { OpportunityListItem } from "@/lib/data/opportunities";
import { opportunityRecommendationLabel, opportunityStatusLabel } from "@/lib/opportunities/catalog";
import Link from "next/link";

export function MapOpportunityPanel({
  item,
  onClose,
}: {
  item: OpportunityListItem;
  onClose: () => void;
}) {
  const location = [item.municipality, item.region].filter(Boolean).join(", ") || item.country;
  const origin = item.originatingSearchId ? "Saved from a screening run" : "Customer entered";
  return (
    <MapObjectPanel
      kind="Opportunity"
      provenance="Customer entered"
      title={item.name}
      subtitle={location}
      testId="map-opportunity-panel"
      onClose={onClose}
      action={
        <Link href={`/opportunities/${item.slug}`} data-testid="map-open-opportunity">
          <Button className="w-full">Open Opportunity</Button>
        </Link>
      }
    >
      <dl className="space-y-1.5">
        <MapFact label="Status" value={opportunityStatusLabel(item.status)} />
        <MapFact label="Recommendation" value={opportunityRecommendationLabel(item.recommendation)} />
        <MapFact
          label="Area"
          value={item.contiguousAreaHa != null ? `${Math.round(item.contiguousAreaHa)} ha` : "Footprint where stored"}
        />
        <MapFact label="Origin" value={origin} />
      </dl>
      <MapPanelNote>
        The polygon is the saved development footprint. The square marks identity. Not an official site boundary
        or available connection capacity.
      </MapPanelNote>
    </MapObjectPanel>
  );
}
