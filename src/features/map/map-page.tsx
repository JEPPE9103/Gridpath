"use client";

import { DevelopmentCompareTable } from "@/features/compare/development-compare-table";
import { SaveComparisonForm } from "@/features/compare/save-comparison-form";
import { SavedComparisonsList } from "@/features/compare/saved-comparisons-list";
import { BellButton } from "@/components/layout/app-shell";
import { ConfidenceBadge, OutlookBadge, StageBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { MapGridContextCard } from "@/features/map/map-grid-context";
import { MapLayerControl } from "@/features/map/map-layer-control";
import { MapLegend } from "@/features/map/map-legend";
import { MapOfficialPanel } from "@/features/map/map-official-panel";
import { MapSpatialSummary } from "@/features/map/map-spatial-summary";
import { SwedenMap } from "@/features/map/sweden-map";
import { markerColor } from "@/features/map/mini-map";
import { cn } from "@/lib/cn";
import type { OfficialCoveringGeojson, OfficialMapAreaContext } from "@/lib/data/official-map";
import type { MapProject, MapProjectsResult } from "@/lib/data/map-types";
import type { SavedComparisonsResult } from "@/lib/data/portfolio-comparisons";
import {
  DEFAULT_OFFICIAL_MAP_LAYERS,
  isUnmatchedReviewProject,
  summarizeOfficialSpatialMatches,
  type OfficialMapFeatureCollection,
  type OfficialMapLayer,
  type OfficialSpatialMatch,
} from "@/lib/domain/official-map";
import { loadOfficialCoveringAction, loadOfficialMapAreaContextAction } from "@/lib/map/actions";
import { OVERVIEW_PIPELINE_STAGES, type OverviewPipelineStage } from "@/lib/data/overview-types";
import { ClientHeaderDate } from "@/components/ui/client-header-date";
import { useWorkspace } from "@/lib/workspace-state";
import {
  OUTLOOKS,
  TECHNOLOGIES,
  type Confidence,
  type Outlook,
  type Technology,
} from "@/types";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const CONFIDENCES: Confidence[] = ["High", "Medium", "Low", "Unknown"];

const EMPTY_FILTERS = {
  technology: "All" as Technology | "All",
  operator: "All",
  stage: "All" as OverviewPipelineStage | "All",
  outlook: "All" as Outlook | "All",
  confidence: "All" as Confidence | "All",
  minImport: "",
  minExport: "",
};

export function MapPage({
  result,
  savedComparisons,
  localNetwork,
  planningArea,
  spatialMatches,
  initialProjectSlug,
  initialChangeArea,
}: {
  result: MapProjectsResult;
  savedComparisons: SavedComparisonsResult;
  localNetwork: OfficialMapFeatureCollection;
  planningArea: OfficialMapFeatureCollection;
  spatialMatches: OfficialSpatialMatch[];
  initialProjectSlug?: string | null;
  initialChangeArea?: { areaId: string; layer: OfficialMapLayer } | null;
}) {
  if (result.kind === "no_organization") {
    return (
      <>
        <PageHeader title="Map & Compare" subtitle="Portfolio map" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="No workspace yet"
            description="This account is not a member of an organisation. Create or join a workspace to compare projects."
          />
        </div>
      </>
    );
  }

  if (result.kind === "error") {
    return (
      <>
        <PageHeader title="Map & Compare" subtitle="Portfolio map" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="Could not load map"
            description="Try again in a moment. If the problem continues, sign in again."
          />
        </div>
      </>
    );
  }

  if (result.projects.length === 0) {
    return (
      <>
        <PageHeader title="Map & Compare" subtitle="Portfolio map" />
        <div className="space-y-4 px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="No projects in this workspace"
            description="Add a project to the portfolio to place it on Map & Compare. Saved team comparisons still appear below."
          />
          {savedComparisons.kind === "ok" ? (
            <SavedComparisonsList
              comparisons={savedComparisons.comparisons}
              canWrite={savedComparisons.canWrite}
            />
          ) : null}
        </div>
      </>
    );
  }

  return (
    <LoadedMapPage
      projects={result.projects}
      savedComparisons={savedComparisons.kind === "ok" ? savedComparisons : null}
      localNetwork={localNetwork}
      planningArea={planningArea}
      spatialMatches={spatialMatches}
      initialProjectSlug={initialProjectSlug ?? null}
      initialChangeArea={initialChangeArea ?? null}
    />
  );
}

function LoadedMapPage({
  projects,
  savedComparisons,
  localNetwork,
  planningArea,
  spatialMatches,
  initialProjectSlug,
  initialChangeArea,
}: {
  projects: MapProject[];
  savedComparisons: Extract<SavedComparisonsResult, { kind: "ok" }> | null;
  localNetwork: OfficialMapFeatureCollection;
  planningArea: OfficialMapFeatureCollection;
  spatialMatches: OfficialSpatialMatch[];
  initialProjectSlug: string | null;
  initialChangeArea: { areaId: string; layer: OfficialMapLayer } | null;
}) {
  const { compareIds, addToCompare, removeFromCompare, clearCompare } = useWorkspace();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialProjectSlug);
  const [compareOpen, setCompareOpen] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [layers, setLayers] = useState(DEFAULT_OFFICIAL_MAP_LAYERS);
  const [unmatchedOnly, setUnmatchedOnly] = useState(false);
  const [covering, setCovering] = useState<OfficialCoveringGeojson | null>(null);
  const [officialContext, setOfficialContext] = useState<OfficialMapAreaContext | null>(null);
  const [officialLoading, setOfficialLoading] = useState(false);
  const [officialAreaId, setOfficialAreaId] = useState<string | null>(
    initialChangeArea?.areaId ?? null,
  );
  const appliedChangeRef = useRef(false);

  const matchByProjectId = useMemo(
    () => new Map(spatialMatches.map((item) => [item.projectId, item])),
    [spatialMatches],
  );

  const operators = useMemo(
    () => ["All", ...new Set(projects.map((project) => project.gridOperator).filter(Boolean))].sort(),
    [projects],
  );

  const filtered = useMemo(
    () =>
      projects.filter((project) => {
        if (!matchesFilters(project, filters)) return false;
        if (!unmatchedOnly) return true;
        return isUnmatchedReviewProject(matchByProjectId.get(project.id), isPlottable(project));
      }),
    [projects, filters, unmatchedOnly, matchByProjectId],
  );
  const mapped = useMemo(() => filtered.filter(isPlottable), [filtered]);
  const ungeocoded = useMemo(
    () => filtered.filter((project) => !isPlottable(project)),
    [filtered],
  );
  const spatialSummary = useMemo(
    () =>
      summarizeOfficialSpatialMatches({
        activeProjects: projects.length,
        plottableProjectIds: projects.filter(isPlottable).map((project) => project.id),
        matches: spatialMatches,
      }),
    [projects, spatialMatches],
  );

  const visibleSelectedSlug =
    selectedSlug && filtered.some((project) => project.slug === selectedSlug) ? selectedSlug : null;
  const selected = visibleSelectedSlug
    ? (projects.find((project) => project.slug === visibleSelectedSlug) ?? null)
    : null;
  const compared = projects.filter((project) => compareIds.includes(project.slug));
  const filtersActive = hasActiveFilters(filters) || unmatchedOnly;

  useEffect(() => {
    if (!selected?.id) return;
    let cancelled = false;
    loadOfficialCoveringAction(selected.id).then((result) => {
      if (!cancelled && result.ok) setCovering(result.covering);
    });
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  const selectProject = useCallback((slug: string) => {
    setSelectedSlug(slug);
    setOfficialAreaId(null);
    setOfficialContext(null);
    setDetailCollapsed(false);
  }, []);

  const selectOfficial = useCallback((input: { areaId: string; layer: OfficialMapLayer }) => {
    setOfficialAreaId(input.areaId);
    setOfficialLoading(true);
    setDetailCollapsed(false);
    loadOfficialMapAreaContextAction(input.areaId).then((result) => {
      setOfficialLoading(false);
      if (result.ok) setOfficialContext(result.context);
    });
  }, []);

  useEffect(() => {
    if (appliedChangeRef.current || !initialChangeArea?.areaId) return;
    appliedChangeRef.current = true;
    setLayers((current) => ({
      ...current,
      localNetwork: initialChangeArea.layer === "local_network" ? true : current.localNetwork,
      planningArea: initialChangeArea.layer === "planning_area" ? true : current.planningArea,
    }));
    selectOfficial(initialChangeArea);
  }, [initialChangeArea, selectOfficial]);

  return (
    <>
      <PageHeader
        title="Map & Compare"
        subtitle="Official Ei geography on your portfolio · covering areas, not connection capacity"
        actions={
          <>
            <Button variant="secondary" onClick={() => setCompareOpen(true)} disabled={compared.length === 0}>
              Temporary compare ({compared.length}/4)
            </Button>
            <Link href="/compare">
              <Button variant="secondary">Saved comparisons</Button>
            </Link>
            <BellButton />
            <ClientHeaderDate />
          </>
        }
      />
      <div className="relative min-h-0 flex-1 px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Select
            label="Technology"
            value={filters.technology}
            options={["All", ...TECHNOLOGIES]}
            onChange={(value) =>
              setFilters((current) => ({ ...current, technology: value as Technology | "All" }))
            }
          />
          <Select
            label="Grid operator"
            value={filters.operator}
            options={operators}
            onChange={(value) => setFilters((current) => ({ ...current, operator: value }))}
          />
          <Select
            label="Stage"
            value={filters.stage}
            options={["All", ...OVERVIEW_PIPELINE_STAGES]}
            onChange={(value) =>
              setFilters((current) => ({
                ...current,
                stage: value as OverviewPipelineStage | "All",
              }))
            }
          />
          <Select
            label="Team outlook"
            value={filters.outlook}
            options={["All", ...OUTLOOKS]}
            onChange={(value) =>
              setFilters((current) => ({ ...current, outlook: value as Outlook | "All" }))
            }
          />
          <Select
            label="Team confidence"
            value={filters.confidence}
            options={["All", ...CONFIDENCES]}
            onChange={(value) =>
              setFilters((current) => ({ ...current, confidence: value as Confidence | "All" }))
            }
          />
          <MwInput
            label="Import ≥"
            value={filters.minImport}
            onChange={(value) => setFilters((current) => ({ ...current, minImport: value }))}
          />
          <MwInput
            label="Export ≥"
            value={filters.minExport}
            onChange={(value) => setFilters((current) => ({ ...current, minExport: value }))}
          />
          <Button variant="ghost" onClick={() => { setFilters(EMPTY_FILTERS); setUnmatchedOnly(false); }} disabled={!filtersActive}>
            Reset filters
          </Button>
        </div>

        <div className="relative h-[calc(100dvh-14.5rem)] min-h-[360px] overflow-hidden rounded-md border border-line bg-surface sm:h-[calc(100vh-220px)] sm:min-h-[520px]">
          <SwedenMap
            projects={mapped}
            selectedId={visibleSelectedSlug}
            layers={layers}
            localNetwork={localNetwork}
            planningArea={planningArea}
            covering={selected ? covering : null}
            highlightAreaId={officialAreaId}
            onSelectProject={selectProject}
            onSelectOfficial={selectOfficial}
          />

          <div className="absolute left-3 top-3 z-10 flex max-h-[42%] max-w-[min(100%-1.5rem,20rem)] flex-col gap-2 overflow-auto sm:left-[16.5rem] sm:max-h-[calc(100%-1.5rem)] sm:max-w-[16rem]">
            <MapLayerControl layers={layers} onChange={setLayers} />
            <MapLegend />
            <MapSpatialSummary
              summary={spatialSummary}
              unmatchedActive={unmatchedOnly}
              onToggleUnmatched={() => setUnmatchedOnly((current) => !current)}
            />
          </div>

          {mapped.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="pointer-events-auto max-w-sm rounded-md border border-line bg-surface px-4 py-3 text-sm shadow-sm">
                <p className="font-medium">No mapped projects match the current filters</p>
                <p className="mt-1 text-muted">
                  {ungeocoded.length > 0
                    ? `${ungeocoded.length} listed project${ungeocoded.length === 1 ? "" : "s"} ${ungeocoded.length === 1 ? "has" : "have"} no map coordinates.`
                    : "Reset filters to see portfolio sites on the map."}
                </p>
              </div>
            </div>
          ) : null}

          <div
            className={cn(
              "absolute left-3 top-3 hidden max-h-[calc(100%-1.5rem)] w-[240px] flex-col overflow-hidden rounded-md border border-line bg-surface sm:flex",
              listCollapsed && "w-auto",
            )}
          >
            {listCollapsed ? (
              <button
                type="button"
                onClick={() => setListCollapsed(false)}
                className="flex items-center gap-1 px-2 py-2 text-xs text-muted hover:text-ink"
              >
                <ChevronRight size={14} />
                List
              </button>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 border-b border-line px-3 py-2">
                  <div>
                    <p className="text-xs font-medium">Team outlook</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-muted">
                      Customer-entered triage colours — not official capacity.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setListCollapsed(true)}
                    className="text-muted hover:text-ink"
                    aria-label="Collapse project list"
                  >
                    <ChevronLeft size={14} />
                  </button>
                </div>
                <div className="border-b border-line px-3 py-2 text-xs">
                  <LegendDot color="#176C4A" label="Favourable" />
                  <LegendDot color="#B54708" label="Possible" />
                  <LegendDot color="#B42318" label="At Risk / Weak" />
                  <LegendDot color="#8B9098" label="Unknown" />
                </div>
                <div className="min-h-0 flex-1 overflow-auto px-1 py-1">
                  {filtered.length === 0 ? (
                    <p className="px-2 py-2 text-xs text-muted">No projects match these filters.</p>
                  ) : (
                    filtered.map((project) => (
                      <button
                        key={project.slug}
                        type="button"
                        onClick={() => {
                          setSelectedSlug(project.slug);
                          setOfficialAreaId(null);
                          setOfficialContext(null);
                          setDetailCollapsed(false);
                        }}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-canvas",
                          visibleSelectedSlug === project.slug && "bg-canvas",
                        )}
                      >
                        <span
                          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: markerColor(project.outlook) }}
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{project.name}</span>
                          <span className="block truncate text-muted">
                            {isPlottable(project) ? project.location || "—" : "Location unavailable"}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {officialAreaId ? (
            <MapOfficialPanel
              context={officialContext}
              loading={officialLoading}
              fromPublishedChange={Boolean(initialChangeArea?.areaId && officialAreaId === initialChangeArea.areaId)}
              onClose={() => {
                setOfficialAreaId(null);
                setOfficialContext(null);
              }}
            />
          ) : selected && !detailCollapsed ? (
            <aside className="absolute inset-x-3 bottom-3 max-h-[58%] overflow-auto rounded-md border border-line bg-surface p-4 md:inset-x-auto md:bottom-auto md:right-3 md:top-3 md:max-h-[calc(100%-1.5rem)] md:w-[320px]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">{selected.name}</h2>
                  <p className="text-sm text-muted">{locationLabel(selected)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDetailCollapsed(true)}
                    className="hidden text-muted hover:text-ink md:inline-flex"
                    aria-label="Collapse project panel"
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button type="button" onClick={() => setSelectedSlug(null)} className="text-muted hover:text-ink">
                    <X size={14} />
                  </button>
                </div>
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <Line label="Technology" value={selected.technology} />
                <Line label="Import / Export MW" value={importExportLabel(selected)} />
                <Line label="Grid operator" value={selected.gridOperator || "—"} />
                <Line label="Team outlook" value={<OutlookBadge outlook={selected.outlook} />} />
                <Line label="Team confidence" value={<ConfidenceBadge confidence={selected.confidence} />} />
                <Line label="Current stage" value={<StageBadge stage={selected.stage} />} />
                <Line label="Target COD" value={selected.targetCOD || "—"} />
                <Line label="Application readiness" value={readinessLabel(selected.readinessPercent)} />
              </dl>
              <MapGridContextCard
                project={selected}
                match={matchByProjectId.get(selected.id)}
                covering={covering}
              />
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link href={`/projects/${selected.slug}`} className="flex-1">
                  <Button className="w-full">Open Project</Button>
                </Link>
                <Button
                  variant="secondary"
                  onClick={() => {
                    addToCompare(selected.slug, selected.name);
                    setCompareOpen(true);
                  }}
                  disabled={compareIds.includes(selected.slug)}
                >
                  Add to Compare
                </Button>
              </div>
            </aside>
          ) : selected && detailCollapsed ? (
            <button
              type="button"
              onClick={() => setDetailCollapsed(false)}
              className="absolute right-3 top-3 hidden rounded-md border border-line bg-surface px-2 py-2 text-xs text-muted hover:text-ink md:flex"
            >
              <ChevronLeft size={14} />
              <span className="ml-1 max-w-[9rem] truncate">{selected.name}</span>
            </button>
          ) : null}
        </div>

        <div className="mt-3 space-y-1">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
            Customer / project data
            <span className="mx-2 text-muted">|</span>
            Official Ei Grid Intelligence · covering geography
            <span className="mx-2 text-muted">|</span>
            Portfolio comparison · development triage ranking
          </p>
          <p className="text-xs leading-5 text-muted">
            Map colours use customer-entered team outlook. Official polygons are Ei local-network
            concession areas and NUP planning geography. Covering official area is geographic
            context, not a connection point. NUP figures are published forecast transfer-capacity
            need and do not represent available connection capacity or grid headroom.
          </p>
          {savedComparisons && savedComparisons.comparisons.length > 0 ? (
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Saved team comparisons</h3>
                <Link href="/compare" className="text-xs text-teal hover:text-teal-dark">
                  View all
                </Link>
              </div>
              <SavedComparisonsList
                comparisons={savedComparisons.comparisons.slice(0, 5)}
                canWrite={savedComparisons.canWrite}
              />
            </div>
          ) : null}
        </div>
      </div>

      {compareOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div>
              <h2 className="text-base font-semibold">
                Temporary comparison ({compared.length}/4)
              </h2>
              <p className="mt-1 text-xs text-muted">
                This panel is a temporary comparison in this browser. Save it to share with your
                team. Development Profile ranking is not official grid intelligence.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={clearCompare} disabled={compared.length === 0}>
                Clear
              </Button>
              <Button variant="secondary" onClick={() => setCompareOpen(false)}>
                Close
              </Button>
            </div>
          </div>
          <div className="px-4 pb-3 sm:px-6 lg:px-8">
            {savedComparisons?.canWrite ? (
              <SaveComparisonForm projectIds={compared.map((project) => project.id)} />
            ) : (
              <p className="text-xs text-muted">Viewers can open saved comparisons but cannot save new ones.</p>
            )}
          </div>
          {compared.length === 0 ? (
            <p className="px-4 pb-6 text-sm text-muted sm:px-6 lg:px-8">
              Select up to four sites from the map to compare development profiles.
            </p>
          ) : (
            <div className="max-h-[50vh] overflow-auto px-4 pb-6 sm:px-6 lg:px-8">
              <DevelopmentCompareTable
                projects={compared}
                onRemove={(slug) => removeFromCompare(slug)}
              />
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

function matchesFilters(
  project: MapProject,
  filters: typeof EMPTY_FILTERS,
): boolean {
  const minImport = parseMw(filters.minImport);
  const minExport = parseMw(filters.minExport);
  return (
    (filters.technology === "All" || project.technology === filters.technology) &&
    (filters.operator === "All" || project.gridOperator === filters.operator) &&
    (filters.stage === "All" || project.stage === filters.stage) &&
    (filters.outlook === "All" || project.outlook === filters.outlook) &&
    (filters.confidence === "All" || project.confidence === filters.confidence) &&
    (minImport == null || project.importMW >= minImport) &&
    (minExport == null || project.exportMW >= minExport)
  );
}

function hasActiveFilters(filters: typeof EMPTY_FILTERS): boolean {
  return (
    filters.technology !== "All" ||
    filters.operator !== "All" ||
    filters.stage !== "All" ||
    filters.outlook !== "All" ||
    filters.confidence !== "All" ||
    filters.minImport !== "" ||
    filters.minExport !== ""
  );
}

function parseMw(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPlottable(project: MapProject): boolean {
  return (
    project.hasCoordinates &&
    Number.isFinite(project.latitude) &&
    Number.isFinite(project.longitude)
  );
}

function locationLabel(project: MapProject): string {
  if (!isPlottable(project)) {
    return project.location ? `${project.location} — Location unavailable` : "Location unavailable";
  }
  return project.location || "—";
}

function importExportLabel(project: MapProject): string {
  return `${project.importMW} / ${project.exportMW} MW`;
}

function readinessLabel(percent: number | null): string {
  return percent == null ? "Not available" : `${percent}%`;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <p className="mt-1 flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </p>
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

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2 text-sm">
      <span className="whitespace-nowrap text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[10rem] bg-transparent text-ink"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function MwInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2 text-sm">
      <span className="whitespace-nowrap text-muted">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="MW"
        className="w-14 bg-transparent text-ink outline-none"
      />
    </label>
  );
}
