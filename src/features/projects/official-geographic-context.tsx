"use client";

import { Button } from "@/components/ui/button";
import type { SourceHealthView } from "@/lib/data/source-health";
import { NUP_DATASET_LABEL } from "@/lib/domain/catalog-labels";
import {
  OFFICIAL_EI_NETWORK_AREA_SOURCE_SLUG,
  OFFICIAL_EI_NUP_SOURCE_SLUG,
  type OfficialGridAreaContext,
  type OfficialNupContext,
} from "@/lib/domain/grid-intelligence";
import {
  COVERING_OFFICIAL_AREA_LABEL,
  unmatchedLocalNetworkCopy,
  unmatchedNupCopy,
} from "@/lib/domain/official-map";
import { formatDate } from "@/lib/format";
import Link from "next/link";

export function OfficialGeographicContextSection({
  slug,
  latitude,
  longitude,
  localNetwork,
  nup,
  sourceHealth,
}: {
  slug: string;
  latitude: number | null;
  longitude: number | null;
  localNetwork: OfficialGridAreaContext | null;
  nup: OfficialNupContext | null;
  sourceHealth: SourceHealthView[];
}) {
  const localArea = localNetwork?.areas[0] ?? null;
  const nupArea = nup?.planningAreas[0] ?? null;
  const localHealth = sourceHealth.find((item) => item.slug === OFFICIAL_EI_NETWORK_AREA_SOURCE_SLUG);
  const nupHealth = sourceHealth.find((item) => item.slug === OFFICIAL_EI_NUP_SOURCE_SLUG);
  const localUnmatched = unmatchedLocalNetworkCopy({
    dataset: "Ei local-network concessions",
    freshness: localNetwork?.provenance?.retrievedAt
      ? formatDate(localNetwork.provenance.retrievedAt)
      : localHealth?.lastSnapshotAt
        ? formatDate(localHealth.lastSnapshotAt)
        : null,
    latitude,
    longitude,
    lastFullIngestAt: localHealth?.lastFullIngestAt
      ? formatDate(localHealth.lastFullIngestAt)
      : null,
    sourceHealth: localHealth?.healthLabel ?? null,
  });
  const nupUnmatched = unmatchedNupCopy({
    dataset: NUP_DATASET_LABEL,
    freshness: nup?.provenance?.retrievedAt
      ? formatDate(nup.provenance.retrievedAt)
      : nupHealth?.lastSnapshotAt
        ? formatDate(nupHealth.lastSnapshotAt)
        : null,
    latitude,
    longitude,
    lastFullIngestAt: nupHealth?.lastFullIngestAt ? formatDate(nupHealth.lastFullIngestAt) : null,
    sourceHealth: nupHealth?.healthLabel ?? null,
  });

  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Official geographic context</h2>
          <p className="mt-1 text-sm text-muted">
            Project location → local network area → NUP context. {COVERING_OFFICIAL_AREA_LABEL}, not a
            connection point. Not an indication of available connection capacity.
          </p>
        </div>
        <Link href={`/map?project=${encodeURIComponent(slug)}`}>
          <Button variant="secondary">View on Map</Button>
        </Link>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">Project location</dt>
          <dd className="mt-1 font-medium">
            {latitude != null && longitude != null
              ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
              : "No primary coordinate"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Local network area</dt>
          <dd className="mt-1 font-medium">{localArea?.name ?? "No match"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">NUP context</dt>
          <dd className="mt-1 font-medium">{nupArea?.name ?? "No match"}</dd>
        </div>
      </dl>
      {!localArea ? (
        <UnmatchedBlock copy={localUnmatched} />
      ) : null}
      {!nupArea ? (
        <UnmatchedBlock copy={nupUnmatched} />
      ) : null}
    </section>
  );
}

function UnmatchedBlock({
  copy,
}: {
  copy: { title: string; body: string; details: string[] };
}) {
  return (
    <div className="mt-4 rounded-md border border-line bg-canvas p-3">
      <p className="text-sm font-medium">{copy.title}</p>
      <p className="mt-1 text-sm leading-6 text-muted">{copy.body}</p>
      <ul className="mt-2 space-y-0.5 text-xs text-muted">
        {copy.details.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
