"use client";

import { Button, buttonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EvidenceCoveragePanel, NetworkCoveringNote, ProvenanceChip } from "@/features/opportunities/evidence-coverage-panel";
import { RefinePendingNotice } from "@/features/opportunities/refine-pending-notice";
import { ScreeningResultsMap } from "@/features/opportunities/screening-results-map";
import type { OpportunityRunCandidate, OpportunitySearchRunView } from "@/lib/data/opportunity-runs";
import { rerunOpportunitySearchAction, refineOpportunityCandidatesAction, saveRunCandidateAction } from "@/lib/opportunities/actions";
import {
  opportunityConfidenceLabel,
  opportunityRecommendationLabel,
  opportunityTechnologyLabel,
} from "@/lib/opportunities/catalog";
import { canCompareOpportunities, compareRecommendation } from "@/lib/opportunities/compare";
import {
  buildEvidenceCoverage,
  candidateToEvidenceInput,
  networkCoveringCopy,
  recommendationConfidenceCaption,
  runSourceNotes,
  screeningFootprintQuality,
  whyCandidateRanks,
} from "@/lib/opportunities/evidence-coverage";
import { describeRunDelta, UNSUPPORTED_SCREENING_DIMENSIONS } from "@/lib/opportunities/spatial-screening";
import {
  landCoverEvidenceLabel,
  refinementStatusLabel,
  terrainEvidenceLabel,
  type EvidenceResolution,
  type RefinementStatus,
} from "@/lib/opportunities/precision";
import { officialTransmissionCopy, projectConnectionCopy, transmissionContextFromRecord } from "@/lib/opportunities/transmission-context";
import Link from "next/link";
import { useMemo, useState } from "react";

function areaLine(candidate: OpportunityRunCandidate): string {
  if (candidate.contiguousAreaHa != null) return `${candidate.contiguousAreaHa.toFixed(1)} ha`;
  if (candidate.usableAreaHa != null) return `${candidate.usableAreaHa.toFixed(1)} ha`;
  return "Area unknown";
}

function sectionOf(candidate: OpportunityRunCandidate): "recommended" | "investigate" | "secondary" | "excluded" | "insufficient" {
  if (candidate.excluded || candidate.recommendation === "low_priority") return "excluded";
  if (candidate.recommendation === "prioritise") return "recommended";
  if (candidate.recommendation === "investigate") return "investigate";
  if (candidate.recommendation === "secondary") return "secondary";
  return "insufficient";
}

export function OpportunitySearchResults({
  view,
  canWrite,
}: {
  view: OpportunitySearchRunView;
  canWrite: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(view.candidates[0]?.id ?? null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const selected = view.candidates.find((item) => item.id === selectedId) ?? null;
  const compareAllowed = canCompareOpportunities(compareIds.length);
  const sourceNotes = runSourceNotes(view.providerAvailability);
  const optionalUnavailable = sourceNotes.filter((item) => !item.available);

  const grouped = useMemo(() => {
    const groups: Record<string, OpportunityRunCandidate[]> = {
      recommended: [],
      investigate: [],
      secondary: [],
      insufficient: [],
      excluded: [],
    };
    for (const candidate of view.candidates) {
      groups[sectionOf(candidate)].push(candidate);
    }
    return groups;
  }, [view.candidates]);

  const delta = describeRunDelta(
    view.previousRun
      ? {
          evaluatedCount: view.previousRun.evaluatedCount,
          excludedCount: 0,
          returnedCount: view.previousRun.returnedCount,
        }
      : null,
    {
      evaluatedCount: view.evaluatedCount,
      excludedCount: view.excludedCount,
      returnedCount: view.returnedCount,
    },
  );

  const eligible = view.candidates.filter(
    (item) => !item.excluded && (item.refinementStatus === "eligible_for_refinement" || item.refinementStatus === "refinement_failed"),
  );
  const topFive = eligible.filter((item) => item.rank != null && item.rank <= 5).map((item) => item.id);
  const selectedEligible = selected && eligible.some((item) => item.id === selected.id);
  const compareItems = view.candidates.filter((item) => compareIds.includes(item.id));
  const selectedCoverage = selected
    ? buildEvidenceCoverage(
        candidateToEvidenceInput(selected, {
          providerAvailability: view.providerAvailability,
          sourceVersions: view.sourceVersions,
        }),
      )
    : null;
  const selectedCovering = selected
    ? networkCoveringCopy({
        localName: selected.localCoveringName,
        nupName: selected.nupCoveringName,
        queried: selected.coveringQueried,
      })
    : null;
  const selectedFootprint = selected
    ? screeningFootprintQuality(selected.geometryQuality, selected.geometryQualityReason)
    : null;

  return (
    <>
      <PageHeader
        title={view.searchName}
        subtitle={`${opportunityTechnologyLabel(view.technology)}${view.electricityArea ? ` · ${view.electricityArea} recorded as intent, not a spatial clip` : ""} · Candidate Sites are the decision objects; Opportunity Zones are broader surviving geography`}
        actions={
          <>
            <Link href="/opportunities" className={buttonClassName("secondary")}>
              All opportunities
            </Link>
            {canWrite ? (
              <form action={rerunOpportunitySearchAction}>
                <input type="hidden" name="searchId" value={view.searchId} />
                <Button type="submit" variant="secondary">
                  Re-run screening
                </Button>
              </form>
            ) : null}
          </>
        }
      />
      <div className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
          <Fact label="Search area" value={searchAreaKm2(view)} />
          <Fact label="Opportunity zones" value={String(view.zones.length)} />
          <Fact label="Candidate sites" value={String(view.candidates.length)} />
          <Fact
            label="Recommended for investigation"
            value={String(view.candidates.filter((item) => item.recommendation === "prioritise" || item.recommendation === "investigate").length)}
          />
        </section>

        {delta ? <p className="text-sm text-muted">{delta}</p> : null}
        {view.changeSummary ? <p className="text-sm text-muted">{view.changeSummary}</p> : null}

        <p className="text-sm text-muted">
          {view.status === "completed"
            ? "Candidate Sites identified. They are target-scale investigation areas grown inside Opportunity Zones after supported exclusions — not land parcels and not the surviving search region."
            : `Run status: ${view.status}.`}
          {view.durationMs != null ? ` Duration ${Math.round(view.durationMs / 1000)}s.` : ""}
          {` Ranking ${view.rankingVersion ?? "suitability-v3"}.`}
        </p>

        {canWrite && (selectedEligible || topFive.length > 0) ? (
          <section className="flex flex-wrap gap-2">
            {selectedEligible && selected ? (
              <form action={refineOpportunityCandidatesAction}>
                <input type="hidden" name="runId" value={view.runId} />
                <input type="hidden" name="searchId" value={view.searchId} />
                <input type="hidden" name="candidateIds" value={selected.id} />
                <Button type="submit" variant="secondary">
                  Refine candidate
                </Button>
                <RefinePendingNotice />
              </form>
            ) : null}
            {topFive.length > 0 ? (
              <form action={refineOpportunityCandidatesAction}>
                <input type="hidden" name="runId" value={view.runId} />
                <input type="hidden" name="searchId" value={view.searchId} />
                <input type="hidden" name="candidateIds" value={topFive.join(",")} />
                <Button type="submit" variant="secondary">
                  Refine top {topFive.length}
                </Button>
                <RefinePendingNotice />
              </form>
            ) : null}
            <p className="self-center text-xs text-muted">
              Detailed screening runs only on selected Candidate Sites (max 5). Discovery uses coarse evidence.
            </p>
          </section>
        ) : null}

        <ScreeningResultsMap
          geojson={view.geojson}
          candidates={view.candidates}
          selectedId={selectedId}
          onSelect={setSelectedId}
          west={view.west}
          south={view.south}
          east={view.east}
          north={view.north}
        />

        {view.warnings.length > 0 ? (
          <section className="rounded-md border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">Run notes</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
              {view.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-md border border-line bg-surface p-4">
          <h2 className="text-sm font-semibold">Source status</h2>
          <p className="mt-1 text-sm text-muted">
            Optional evidence that is unavailable is marked not evaluated. The search continues. This is
            not a failed search unless a required source blocked screening.
          </p>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {sourceNotes.length > 0 ? (
              sourceNotes.map((note) => (
                <li key={note.key} className="flex items-baseline justify-between gap-3">
                  <span>{note.label}</span>
                  <span className={note.available ? "text-ink" : "text-muted"}>
                    {note.available ? "Evaluated" : "Not evaluated"}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-muted">Source availability was not recorded for this run.</li>
            )}
          </ul>
          {optionalUnavailable.length > 0 ? (
            <p className="mt-3 text-xs text-muted">
              Not evaluated: {optionalUnavailable.map((item) => item.label).join(", ")}.
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted">Unsupported in this release: {UNSUPPORTED_SCREENING_DIMENSIONS.join("; ")}.</p>
        </section>

        {(["recommended", "investigate", "secondary", "insufficient", "excluded"] as const).map((key) => (
          <CandidateSection
            key={key}
            title={
              key === "recommended"
                ? "Recommended Candidate Sites"
                : key === "investigate"
                  ? "Worth investigating"
                  : key === "secondary"
                    ? "Secondary"
                    : key === "insufficient"
                      ? "Insufficient evidence"
                      : "Excluded"
            }
            candidates={grouped[key]}
            selectedId={selectedId}
            compareIds={compareIds}
            canWrite={canWrite}
            providerAvailability={view.providerAvailability}
            sourceVersions={view.sourceVersions}
            onSelect={setSelectedId}
            onToggleCompare={(id) =>
              setCompareIds((current) =>
                current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(0, 4),
              )
            }
          />
        ))}

        {selected && selectedCoverage && selectedCovering && selectedFootprint ? (
          <section className="rounded-md border border-line bg-surface p-4">
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted">Selected Candidate Site</p>
            <h2 className="mt-1 text-sm font-semibold">
              {selected.rank != null ? `#${selected.rank} ` : ""}
              {selected.name}
            </h2>
            <p className="mt-1 text-sm">{opportunityRecommendationLabel(selected.recommendation)}</p>
            <p className="mt-1 text-sm text-muted">{selected.recommendationSummary}</p>
            <ProvenanceChip label="Noxheim Derived" />
            <p className="mt-3 text-sm">{areaLine(selected)}</p>
            <p className="mt-1 text-xs text-muted">
              {[selected.municipalityName, selected.countyName].filter(Boolean).join(" · ") || "Location from screening geometry"}
            </p>
            {selected.rankChangeExplanation ? (
              <p className="mt-2 text-sm">{selected.rankChangeExplanation}</p>
            ) : null}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Why it ranks well</h3>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {whyCandidateRanks(selected).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-muted">
                  {recommendationConfidenceCaption(selected.dataConfidence, selectedCoverage)}
                </p>
                <p className="mt-2 text-xs text-muted">
                  Recommendation confidence: {opportunityConfidenceLabel(selected.dataConfidence)} ·{" "}
                  {selectedCoverage.summary}
                </p>
              </div>
              <NetworkCoveringNote
                title={selectedCovering.title}
                detail={selectedCovering.detail}
                note={selectedCovering.note}
              />
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Screening footprint quality</p>
              <p className="mt-1 text-sm font-medium">{selectedFootprint.label}</p>
              {selectedFootprint.explanation ? (
                <p className="mt-1 text-xs leading-5 text-muted">{selectedFootprint.explanation}</p>
              ) : null}
            </div>

            <div className="mt-4">
              <EvidenceCoveragePanel coverage={selectedCoverage} />
            </div>

            <details className="mt-4 rounded-md border border-line bg-canvas p-3">
              <summary className="cursor-pointer text-sm font-medium">Technical detail</summary>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <Fact label="Gross screening area" value={selected.grossAreaHa != null ? `${selected.grossAreaHa.toFixed(1)} ha` : "Unknown"} />
                <Fact
                  label="Screening evidence"
                  value={
                    selected.refinementStatus
                      ? refinementStatusLabel(selected.refinementStatus as RefinementStatus)
                      : "Discovery screening"
                  }
                />
                <Fact
                  label="Terrain evidence"
                  value={terrainEvidenceLabel({
                    resolution: (selected.terrainResolution as EvidenceResolution | null) ?? "unavailable",
                    providerKey: selected.terrainProviderKey,
                  })}
                />
                <Fact
                  label="Land cover"
                  value={
                    Object.keys(selected.landCover).length > 0
                      ? `${landCoverEvidenceLabel({
                          resolution: (selected.landCoverResolution as EvidenceResolution | null) ?? "coarse",
                          providerKey: selected.landCoverProviderKey,
                          sourceResolutionM:
                            selected.landCoverProviderKey === "nv-nmd-2023" ? 10 : undefined,
                          processingResolutionM:
                            selected.landCoverProviderKey === "nv-nmd-2023" &&
                            selected.landCoverResolution === "detailed"
                              ? undefined
                              : selected.landCoverProviderKey === "nv-nmd-2023"
                                ? 1000
                                : undefined,
                        })} · ${Object.entries(selected.landCover)
                          .sort((left, right) => Number(right[1]) - Number(left[1]))
                          .slice(0, 3)
                          .map(([group, share]) => `${group} ${Number(share).toFixed(0)}%`)
                          .join(" · ")}`
                      : landCoverEvidenceLabel({
                          resolution: "unavailable",
                          providerKey: selected.landCoverProviderKey,
                        })
                  }
                />
                <Fact
                  label="Transmission context"
                  value={officialTransmissionCopy(
                    transmissionContextFromRecord(selected.transmissionContext, selected.countyName),
                  )}
                />
                <Fact label="Project-specific connection" value={projectConnectionCopy()} />
                <Fact label="Strongest positive" value={selected.keyPositive ?? "None recorded"} />
                <Fact label="Main uncertainty" value={selected.keyRisk ?? "See unsupported dimensions"} />
              </dl>
              {selected.exclusionBreakdown ? (
                <div className="mt-4 text-sm">
                  <p className="font-medium">Exclusion breakdown</p>
                  <ul className="mt-1 space-y-1 text-muted">
                    <li>Protected: −{Number(selected.exclusionBreakdown.protectedHa ?? 0).toFixed(1)} ha</li>
                    <li>Natura: −{Number(selected.exclusionBreakdown.naturaHa ?? 0).toFixed(1)} ha</li>
                    <li>
                      Terrain: −
                      {Number(
                        selected.exclusionBreakdown.refinementTerrainHa ?? selected.exclusionBreakdown.terrainHa ?? 0,
                      ).toFixed(1)}{" "}
                      ha
                    </li>
                    <li>
                      Land cover: −
                      {Number(
                        selected.exclusionBreakdown.refinementLandCoverHa ??
                          selected.exclusionBreakdown.landCoverHa ??
                          0,
                      ).toFixed(1)}{" "}
                      ha
                    </li>
                  </ul>
                </div>
              ) : null}
            </details>
            {selected.exclusionReason ? (
              <p className="mt-3 text-sm">{selected.exclusionReason}</p>
            ) : null}
            {canWrite && !selected.savedOpportunityId ? (
              <form action={saveRunCandidateAction} className="mt-4">
                <input type="hidden" name="candidateId" value={selected.id} />
                <Button type="submit">Save as opportunity</Button>
              </form>
            ) : null}
            {selected.savedOpportunityId ? (
              <p className="mt-3 text-sm text-muted">Already saved as an opportunity.</p>
            ) : null}
          </section>
        ) : null}

        {compareAllowed.ok ? (
          <section className="rounded-md border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">Compare selected Candidate Sites</h2>
            <p className="mt-1 text-sm text-muted">
              Relative investigation priority from stored evidence — not a success score.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-line px-2 py-1 text-left">Field</th>
                    {compareItems
                      .slice()
                      .sort((left, right) => compareRecommendation(left.recommendation, right.recommendation))
                      .map((item) => (
                        <th key={item.id} className="border-b border-line px-2 py-1 text-left">
                          {item.name}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Recommendation", (item: OpportunityRunCandidate) => opportunityRecommendationLabel(item.recommendation)],
                    ["Confidence", (item: OpportunityRunCandidate) => opportunityConfidenceLabel(item.dataConfidence)],
                    [
                      "Contiguous ha",
                      (item: OpportunityRunCandidate) =>
                        item.contiguousAreaHa != null
                          ? item.contiguousAreaHa.toFixed(1)
                          : item.usableAreaHa != null
                            ? item.usableAreaHa.toFixed(1)
                            : "—",
                    ],
                    [
                      "Network area",
                      (item: OpportunityRunCandidate) =>
                        `${item.localCoveringName ?? "None"} — official covering, not capacity`,
                    ],
                    [
                      "Evidence",
                      (item: OpportunityRunCandidate) =>
                        buildEvidenceCoverage(
                          candidateToEvidenceInput(item, { providerAvailability: view.providerAvailability }),
                        ).summary,
                    ],
                    ["Positive", (item: OpportunityRunCandidate) => item.keyPositive ?? "—"],
                    ["Risk", (item: OpportunityRunCandidate) => item.keyRisk ?? "—"],
                  ].map(([label, render]) => (
                    <tr key={String(label)}>
                      <td className="border-b border-line px-2 py-1 text-muted">{label as string}</td>
                      {compareItems.map((item) => (
                        <td key={item.id} className="border-b border-line px-2 py-1">
                          {(render as (item: OpportunityRunCandidate) => string)(item)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : compareIds.length === 1 ? (
          <p className="text-sm text-muted">Select a second Candidate Site to compare.</p>
        ) : null}

        {view.methodology ? (
          <p className="text-xs text-muted">{view.methodology}</p>
        ) : null}
      </div>
    </>
  );
}

function CandidateSection({
  title,
  candidates,
  selectedId,
  compareIds,
  canWrite,
  providerAvailability,
  sourceVersions,
  onSelect,
  onToggleCompare,
}: {
  title: string;
  candidates: OpportunityRunCandidate[];
  selectedId: string | null;
  compareIds: string[];
  canWrite: boolean;
  providerAvailability: Record<string, boolean>;
  sourceVersions: Record<string, string | null>;
  onSelect: (id: string) => void;
  onToggleCompare: (id: string) => void;
}) {
  if (candidates.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold">
        {title} ({candidates.length})
      </h2>
      <ul className="mt-2 divide-y divide-line overflow-hidden rounded-md border border-line">
        {candidates.map((candidate) => {
          const coverage = buildEvidenceCoverage(
            candidateToEvidenceInput(candidate, { providerAvailability, sourceVersions }),
          );
          const covering = networkCoveringCopy({
            localName: candidate.localCoveringName,
            nupName: candidate.nupCoveringName,
            queried: candidate.coveringQueried,
          });
          const footprint = screeningFootprintQuality(candidate.geometryQuality, candidate.geometryQualityReason);
          const where = [candidate.municipalityName, candidate.countyName].filter(Boolean).join(" · ");
          return (
            <li
              key={candidate.id}
              className={`bg-surface px-4 py-3 ${selectedId === candidate.id ? "bg-canvas" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button type="button" className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink" onClick={() => onSelect(candidate.id)}>
                  <p className="text-sm font-medium">
                    {candidate.rank != null ? `#${candidate.rank} ` : ""}
                    {candidate.name}
                  </p>
                  <p className="mt-1 text-xs text-muted">{where || "Candidate Site"}</p>
                  <p className="mt-2 text-sm">{areaLine(candidate)}</p>
                  <p className="mt-1 text-sm">{opportunityRecommendationLabel(candidate.recommendation)}</p>
                  <ul className="mt-2 list-disc pl-5 text-xs text-muted">
                    {whyCandidateRanks(candidate)
                      .slice(0, 3)
                      .map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted">
                    Evidence {coverage.evaluatedCount}/{coverage.totalCount} categories evaluated
                    {coverage.missingLabels.length > 0 ? ` · Missing: ${coverage.missingLabels.slice(0, 3).join(", ")}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Network area: {covering.title}. {covering.note}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {footprint.label}
                    {candidate.exclusionReason ? ` · ${candidate.exclusionReason}` : ""}
                  </p>
                </button>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buttonClassName("secondary")}
                    onClick={() => onToggleCompare(candidate.id)}
                  >
                    {compareIds.includes(candidate.id) ? "Remove from compare" : "Compare"}
                  </button>
                  {canWrite && !candidate.savedOpportunityId ? (
                    <form action={saveRunCandidateAction}>
                      <input type="hidden" name="candidateId" value={candidate.id} />
                      <Button type="submit" variant="secondary">
                        Save
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function searchAreaKm2(view: OpportunitySearchRunView): string {
  if (view.west == null || view.south == null || view.east == null || view.north == null) return "Unknown";
  const km = Math.abs(view.east - view.west) * 111.32 * Math.cos((((view.south + view.north) / 2) * Math.PI) / 180)
    * Math.abs(view.north - view.south) * 110.57;
  return `~${Math.round(km)} km²`;
}
