"use client";

import { ConfidenceBadge, OutlookBadge, StageBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { MapGridContextCard } from "@/features/map/map-grid-context";
import { MapFact, MapObjectPanel, MapPanelNote } from "@/features/map/map-object-panel";
import type { OfficialCoveringGeojson, OfficialLoadStatus } from "@/lib/data/official-map";
import type { MapProject } from "@/lib/data/map-types";
import type { OpportunityListItem } from "@/lib/data/opportunities";
import type { OfficialSpatialMatch } from "@/lib/domain/official-map";
import Link from "next/link";

export function MapProjectPanel({
  project,
  originOpportunity,
  location,
  match,
  covering,
  coveringStatus,
  matchesStatus,
  coveringLoading,
  onClose,
  onAddToCompare,
  compareDisabled,
}: {
  project: MapProject;
  originOpportunity: OpportunityListItem | null;
  location: string;
  match: OfficialSpatialMatch | undefined;
  covering: OfficialCoveringGeojson | null;
  coveringStatus: OfficialLoadStatus;
  matchesStatus: OfficialLoadStatus;
  coveringLoading: boolean;
  onClose: () => void;
  onAddToCompare: () => void;
  compareDisabled: boolean;
}) {
  const nextAction =
    project.connectionCase?.nextMilestone || project.openAlerts[0]?.title || "None recorded";
  return (
    <MapObjectPanel
      kind="Project"
      provenance="Customer entered"
      title={project.name}
      subtitle={location}
      testId="map-project-panel"
      onClose={onClose}
      action={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={`/projects/${project.slug}`} className="flex-1">
            <Button className="w-full">Open Project</Button>
          </Link>
          <Button variant="secondary" onClick={onAddToCompare} disabled={compareDisabled}>
            Add to Compare
          </Button>
        </div>
      }
    >
      <dl className="space-y-1.5">
        <MapFact label="Stage" value={<StageBadge stage={project.stage} />} />
        <MapFact label="Next action" value={nextAction} />
        <MapFact label="Operator" value={project.gridOperator || "—"} />
        <MapFact label="Import / Export" value={`${project.importMW} / ${project.exportMW} MW`} />
        <MapFact label="Team outlook" value={<OutlookBadge outlook={project.outlook} />} />
        <MapFact label="Team confidence" value={<ConfidenceBadge confidence={project.confidence} />} />
      </dl>
      {originOpportunity ? (
        <MapPanelNote>
          Promoted from Opportunity {originOpportunity.name}. The Opportunity record remains in the
          lifecycle; the Project is the active map object.
        </MapPanelNote>
      ) : null}
      <MapGridContextCard
        project={project}
        match={match}
        covering={covering}
        coveringStatus={coveringStatus}
        matchesStatus={matchesStatus}
        coveringLoading={coveringLoading}
      />
    </MapObjectPanel>
  );
}
