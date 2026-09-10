"use client";

import { Button } from "@/components/ui/button";
import type { OfficialCoveringGeojson } from "@/lib/data/official-map";
import type { MapProject } from "@/lib/data/map-types";
import type { OfficialSpatialMatch } from "@/lib/domain/official-map";
import { COVERING_OFFICIAL_AREA_LABEL, officialMapContextLabel } from "@/lib/domain/official-map";
import Link from "next/link";

export function MapGridContextCard({
  project,
  match,
  covering,
}: {
  project: MapProject;
  match: OfficialSpatialMatch | undefined;
  covering: OfficialCoveringGeojson | null;
}) {
  const local = officialMapContextLabel({
    coveringName: covering?.localNetwork?.properties.name,
    matched: Boolean(match?.localAreaId),
  });
  const nup = officialMapContextLabel({
    coveringName: covering?.planningArea?.properties.name,
    matched: Boolean(match?.nupAreaId),
  });
  return (
    <div className="mt-4 rounded-md border border-line bg-canvas p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        Grid context
      </p>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Local network</dt>
          <dd>{local}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Network development plan</dt>
          <dd>{nup}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Official sources</dt>
          <dd>Ei</dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] leading-4 text-muted">
        {COVERING_OFFICIAL_AREA_LABEL} — geographic covering, not a connection point. Not an indication
        of available connection capacity.
      </p>
      <Link href={`/projects/${project.slug}?tab=grid`} className="mt-3 block">
        <Button variant="secondary" className="w-full">
          View Grid Intelligence
        </Button>
      </Link>
    </div>
  );
}
