"use client";

import { Button, buttonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ScreeningResultsMap } from "@/features/opportunities/screening-results-map";
import type { OpportunityRunCandidate, OpportunitySearchRunView } from "@/lib/data/opportunity-runs";
import { rerunOpportunitySearchAction, refineOpportunityCandidatesAction, saveRunCandidateAction } from "@/lib/opportunities/actions";
import {
  opportunityConfidenceLabel,
  opportunityRecommendationLabel,
  opportunityTechnologyLabel,
} from "@/lib/opportunities/catalog";
import { canCompareOpportunities, compareRecommendation } from "@/lib/opportunities/compare";
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

  return (
    <>
      <PageHeader
        title={view.searchName}
        subtitle={`${opportunityTechnologyLabel(view.technology)}${view.electricityArea ? ` · ${view.electricityArea} recorded as intent, not a spatial clip` : ""} · contiguous candidate areas, not parcels`}
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
          <Fact label="Candidate areas identified" value={String(view.returnedCount)} />
          <Fact label="Areas evaluated" value={String(view.evaluatedCount)} />
          <Fact label="Excluded" value={String(view.excludedCount)} />
          <Fact
            label="Screening stage"
            value={view.screeningStage === "detailed" ? "Detailed site screening" : "Discovery screening"}
          />
        </section>

        {delta ? <p className="text-sm text-muted">{delta}</p> : null}
        {view.changeSummary ? <p className="text-sm text-muted">{view.changeSummary}</p> : null}

        <p className="text-sm text-muted">
          {view.status === "completed"
            ? "Discovery screening finished. Candidate Areas are contiguous remaining geometry after supported exclusions — not land parcels and not 1 km cells as final sites."
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
              </form>
            ) : null}
            <p className="self-center text-xs text-muted">
              Detailed screening runs only on selected Candidate Areas (max 5). Discovery uses coarse evidence.
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
          <h2 className="text-sm font-semibold">Supported vs unsupported evidence</h2>
          <p className="mt-1 text-sm text-muted">
            Data confidence is evidence coverage, not project success probability. Proximity to
            electricity infrastructure is not available, and would not mean available connection
            capacity.
          </p>
          <p className="mt-2 text-sm">
            Layer availability:{" "}
            {Object.entries(view.providerAvailability)
              .map(([key, value]) => `${key}: ${value ? "current ingest present" : "unavailable"}`)
              .join(" · ") || "Not recorded"}
          </p>
          <p className="mt-2 text-xs text-muted">Unsupported in this release: {UNSUPPORTED_SCREENING_DIMENSIONS.join("; ")}.</p>
        </section>

        {(["recommended", "investigate", "secondary", "insufficient", "excluded"] as const).map((key) => (
          <CandidateSection
            key={key}
            title={
              key === "recommended"
                ? "Recommended"
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
            onSelect={setSelectedId}
            onToggleCompare={(id) =>
              setCompareIds((current) =>
                current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(0, 4),
              )
            }
          />
        ))}

        {selected ? (
          <section className="rounded-md border border-line bg-surface p-4">
            <h2 className="text-sm font-semibold">
              {selected.rank != null ? `#${selected.rank} ` : ""}
              {selected.name}
            </h2>
            <p className="mt-1 text-sm text-muted">{selected.recommendationSummary}</p>
            {selected.rankChangeExplanation ? (
              <p className="mt-2 text-sm">{selected.rankChangeExplanation}</p>
            ) : null}
            {selected.discoveryRank != null && selected.detailedRank != null ? (
              <p className="mt-1 text-xs text-muted">
                Discovery rank #{selected.discoveryRank}
                {selected.detailedRank != selected.discoveryRank ? ` · Detailed rank #${selected.detailedRank}` : ""}
              </p>
            ) : null}
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <Fact label="Recommendation" value={opportunityRecommendationLabel(selected.recommendation)} />
              <Fact label="Data confidence" value={opportunityConfidenceLabel(selected.dataConfidence)} />
              <Fact
                label="Largest contiguous usable area"
                value={
                  selected.contiguousAreaHa != null
                    ? `${selected.contiguousAreaHa.toFixed(1)} ha`
                    : selected.usableAreaHa != null
                      ? `${selected.usableAreaHa.toFixed(1)} ha`
                      : "Unknown"
                }
              />
              <Fact
                label="Gross screening area"
                value={selected.grossAreaHa != null ? `${selected.grossAreaHa.toFixed(1)} ha` : "Unknown"}
              />
              <Fact
                label="Terrain"
                value={
                  selected.pctBelowSlope != null
                    ? `${selected.pctBelowSlope.toFixed(1)}% ≤ configured slope${selected.p90SlopeDeg != null ? ` · P90 ${selected.p90SlopeDeg.toFixed(1)}°` : ""}`
                    : "Insufficient evidence"
                }
              />
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
                label="Road proximity"
                value={
                  selected.roadDistanceM != null
                    ? `${Math.round(selected.roadDistanceM)} m${selected.roadClass ? ` (${selected.roadClass})` : ""}`
                    : "Insufficient evidence"
                }
              />
              <Fact
                label="Local / distribution context"
                value={
                  [selected.localCoveringName, selected.nupCoveringName].filter(Boolean).join(" · ") ||
                  "No covering polygon at centroid"
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
              <Fact label="Residential context" value="Unsupported / blocked pending data rights" />
            </dl>
            {selected.exclusionBreakdown ? (
              <div className="mt-4 rounded-md border border-line bg-canvas p-3 text-sm">
                <p className="font-medium">Before refinement</p>
                <p className="mt-1 text-muted">
                  Gross candidate: {Number(selected.exclusionBreakdown.grossHa ?? selected.grossAreaHa ?? 0).toFixed(1)} ha
                </p>
                <p className="mt-3 font-medium">Detailed exclusions</p>
                <ul className="mt-1 space-y-1 text-muted">
                  <li>Protected: −{Number(selected.exclusionBreakdown.protectedHa ?? 0).toFixed(1)} ha</li>
                  <li>Natura: −{Number(selected.exclusionBreakdown.naturaHa ?? 0).toFixed(1)} ha</li>
                  <li>
                    Terrain: −
                    {Number(
                      selected.exclusionBreakdown.refinementTerrainHa ??
                        selected.exclusionBreakdown.terrainHa ??
                        0,
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
                <p className="mt-3 font-medium">Result</p>
                <p className="mt-1 text-muted">
                  Remaining:{" "}
                  {Number(
                    selected.exclusionBreakdown.refinementRemainingHa ??
                      selected.exclusionBreakdown.remainingHa ??
                      selected.usableAreaHa ??
                      0,
                  ).toFixed(1)}{" "}
                  ha
                </p>
                <p className="text-muted">
                  Largest contiguous area:{" "}
                  {Number(
                    selected.exclusionBreakdown.refinementLargestContiguousHa ??
                      selected.exclusionBreakdown.largestContiguousHa ??
                      selected.contiguousAreaHa ??
                      0,
                  ).toFixed(1)}{" "}
                  ha
                  {selected.discoveryContiguousAreaHa != null
                    ? ` (discovery ${selected.discoveryContiguousAreaHa.toFixed(1)} ha)`
                    : ""}
                </p>
              </div>
            ) : null}
            {selected.exclusionReason ? (
              <p className="mt-3 text-sm">Failed: {selected.exclusionReason}</p>
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
            <h2 className="text-sm font-semibold">Compare selected candidate areas</h2>
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
                      "Discovery rank",
                      (item: OpportunityRunCandidate) =>
                        item.discoveryRank != null ? `#${item.discoveryRank}` : "—",
                    ],
                    [
                      "Detailed rank",
                      (item: OpportunityRunCandidate) =>
                        item.detailedRank != null ? `#${item.detailedRank}` : "Discovery only",
                    ],
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
                      "Terrain P90",
                      (item: OpportunityRunCandidate) =>
                        item.p90SlopeDeg != null ? `${item.p90SlopeDeg.toFixed(1)}°` : "—",
                    ],
                    [
                      "Road",
                      (item: OpportunityRunCandidate) =>
                        item.roadDistanceM != null ? `${Math.round(item.roadDistanceM)} m` : "—",
                    ],
                    ["Positive", (item: OpportunityRunCandidate) => item.keyPositive ?? "—"],
                    ["Risk", (item: OpportunityRunCandidate) => item.keyRisk ?? "—"],
                    ["Grid geography", (item: OpportunityRunCandidate) => item.localCoveringName ?? "None"],
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
          <p className="text-sm text-muted">Select a second candidate area to compare.</p>
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
  onSelect,
  onToggleCompare,
}: {
  title: string;
  candidates: OpportunityRunCandidate[];
  selectedId: string | null;
  compareIds: string[];
  canWrite: boolean;
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
        {candidates.map((candidate) => (
          <li
            key={candidate.id}
            className={`bg-surface px-4 py-3 ${selectedId === candidate.id ? "bg-canvas" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <button type="button" className="text-left" onClick={() => onSelect(candidate.id)}>
                <p className="text-sm font-medium">
                  {candidate.rank != null ? `#${candidate.rank} ` : ""}
                  {candidate.name}
                </p>
                <p className="text-xs text-muted">
                  {opportunityRecommendationLabel(candidate.recommendation)} ·{" "}
                  {opportunityConfidenceLabel(candidate.dataConfidence)}
                  {candidate.contiguousAreaHa != null
                    ? ` · ${candidate.contiguousAreaHa.toFixed(1)} ha contiguous`
                    : candidate.usableAreaHa != null
                      ? ` · ${candidate.usableAreaHa.toFixed(1)} ha usable`
                      : ""}
                  {candidate.roadDistanceM != null ? ` · road ${Math.round(candidate.roadDistanceM)} m` : ""}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {candidate.exclusionReason
                    ? candidate.exclusionReason
                    : `${candidate.keyPositive ?? "No positive official signal stored"} · ${candidate.keyRisk ?? "See unsupported dimensions"}`}
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
        ))}
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
