"use client";

import { DevelopmentCompareTable } from "@/features/compare/development-compare-table";
import { SaveComparisonForm } from "@/features/compare/save-comparison-form";
import { BellButton } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState, EmptyWorkspaceAction, ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { MapCandidatePanel } from "@/features/map/map-candidate-panel";
import { MapDiscoveryControl } from "@/features/map/map-discovery-control";
import { MapLayerControl } from "@/features/map/map-layer-control";
import { MapLegend } from "@/features/map/map-legend";
import { MapOfficialPanel } from "@/features/map/map-official-panel";
import { MapOpportunityPanel } from "@/features/map/map-opportunity-panel";
import { MapProjectPanel } from "@/features/map/map-project-panel";
import { MapSpatialSummary } from "@/features/map/map-spatial-summary";
import { MapToolbarToggle } from "@/features/map/map-object-panel";
import { SwedenMap } from "@/features/map/sweden-map";
import { markerColor } from "@/features/map/mini-map";
import { cn } from "@/lib/cn";
import { formatOutlookLabel } from "@/lib/format";
import type { MapDiscoveryRunPayload } from "@/lib/data/map-discovery";
import type { OfficialCoveringGeojson, OfficialLoadStatus, OfficialMapAreaContext } from "@/lib/data/official-map";
import type { MapProject, MapProjectsResult } from "@/lib/data/map-types";
import type { OpportunityListItem } from "@/lib/data/opportunities";
import type { SavedComparisonsResult } from "@/lib/data/portfolio-comparisons";
import {
  DEFAULT_OFFICIAL_MAP_LAYERS,
  isUnmatchedReviewProject,
  officialMapAreaPreviewShell,
  summarizeOfficialSpatialMatches,
  type OfficialMapAreaPreview,
  type OfficialMapFeatureCollection,
  type OfficialMapLayer,
  type OfficialSpatialMatch,
} from "@/lib/domain/official-map";
import {
  EMPTY_DISCOVERY_GEOJSON,
  opportunityFootprintsCollection,
  isCompletedDiscoveryRun,
  type MapDiscoverySearch,
  type MapSearchArea,
} from "@/lib/domain/map-discovery";
import { loadMapDiscoveryRunAction, loadOfficialCoveringAction, loadOfficialMapAreaContextAction } from "@/lib/map/actions";
import {
  getCachedValue,
  peekCachedValue,
  setCachedValue,
} from "@/lib/map/official-geometry-cache";
import { OVERVIEW_PIPELINE_STAGES, type OverviewPipelineStage } from "@/lib/data/overview-types";
import { useWorkspace } from "@/lib/workspace-state";
import {
  OUTLOOKS,
  TECHNOLOGIES,
  type Confidence,
  type Outlook,
  type Technology,
} from "@/types";
import { Maximize2, Minimize2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  opportunities = [],
  discoverySearches = [],
  savedComparisons,
  localNetwork,
  planningArea,
  spatialMatches,
  officialStatus,
  initialProjectSlug,
  initialChangeArea,
  initialRunId,
  initialOpportunitySlug,
  initialCandidateId,
}: {
  result: MapProjectsResult;
  opportunities?: OpportunityListItem[];
  discoverySearches?: MapDiscoverySearch[];
  savedComparisons: SavedComparisonsResult;
  localNetwork: OfficialMapFeatureCollection;
  planningArea: OfficialMapFeatureCollection;
  spatialMatches: OfficialSpatialMatch[];
  officialStatus?: {
    localNetwork: OfficialLoadStatus;
    planningArea: OfficialLoadStatus;
    matches: OfficialLoadStatus;
  };
  initialProjectSlug?: string | null;
  initialChangeArea?: { areaId: string; layer: OfficialMapLayer } | null;
  initialRunId?: string | null;
  initialOpportunitySlug?: string | null;
  initialCandidateId?: string | null;
}) {
  if (result.kind === "no_organization") {
    return (
      <>
        <PageHeader eyebrow="Discover" title="Map" subtitle="One spatial workspace from screening to development" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="No workspace yet"
            description="This account is not a member of an organisation. Create or join a workspace to compare projects."
            action={<EmptyWorkspaceAction />}
          />
        </div>
      </>
    );
  }

  if (result.kind === "error") {
    return (
      <>
        <PageHeader eyebrow="Discover" title="Map" subtitle="One spatial workspace from screening to development" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <ErrorState
            title="Could not load map"
            description="Try again in a moment. If the problem continues, sign in again."
          />
        </div>
      </>
    );
  }

  return (
    <LoadedMapPage
      projects={result.projects}
      opportunities={opportunities}
      discoverySearches={discoverySearches}
      savedComparisons={savedComparisons.kind === "ok" ? savedComparisons : null}
      localNetwork={localNetwork}
      planningArea={planningArea}
      spatialMatches={spatialMatches}
      officialStatus={officialStatus ?? { localNetwork: "available", planningArea: "available", matches: "available" }}
      initialProjectSlug={initialProjectSlug ?? null}
      initialChangeArea={initialChangeArea ?? null}
      initialRunId={initialRunId ?? null}
      initialOpportunitySlug={initialOpportunitySlug ?? null}
      initialCandidateId={initialCandidateId ?? null}
    />
  );
}

function LoadedMapPage({
  projects,
  opportunities,
  discoverySearches,
  savedComparisons,
  localNetwork,
  planningArea,
  spatialMatches,
  officialStatus,
  initialProjectSlug,
  initialChangeArea,
  initialRunId,
  initialOpportunitySlug,
  initialCandidateId,
}: {
  projects: MapProject[];
  opportunities: OpportunityListItem[];
  discoverySearches: MapDiscoverySearch[];
  savedComparisons: Extract<SavedComparisonsResult, { kind: "ok" }> | null;
  localNetwork: OfficialMapFeatureCollection;
  planningArea: OfficialMapFeatureCollection;
  spatialMatches: OfficialSpatialMatch[];
  officialStatus: {
    localNetwork: OfficialLoadStatus;
    planningArea: OfficialLoadStatus;
    matches: OfficialLoadStatus;
  };
  initialProjectSlug: string | null;
  initialChangeArea: { areaId: string; layer: OfficialMapLayer } | null;
  initialRunId: string | null;
  initialOpportunitySlug: string | null;
  initialCandidateId: string | null;
}) {
  const router = useRouter();
  const { compareIds, addToCompare, removeFromCompare, clearCompare } = useWorkspace();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialProjectSlug);
  const [selectedOpportunitySlug, setSelectedOpportunitySlug] = useState<string | null>(initialOpportunitySlug);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(initialCandidateId);
  const [compareOpen, setCompareOpen] = useState(false);
  const [chromePanel, setChromePanel] = useState<null | "filters" | "layers" | "legend" | "projects">(null);
  const [panelsHidden, setPanelsHidden] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [layers, setLayers] = useState(DEFAULT_OFFICIAL_MAP_LAYERS);
  const [unmatchedOnly, setUnmatchedOnly] = useState(false);
  const [fetchedCovering, setFetchedCovering] = useState<{
    projectId: string;
    covering: OfficialCoveringGeojson;
  } | null>(null);
  const [officialContext, setOfficialContext] = useState<OfficialMapAreaContext | null>(null);
  const [officialLoading, setOfficialLoading] = useState(false);
  const [officialPreview, setOfficialPreview] = useState<OfficialMapAreaPreview | null>(
    initialChangeArea ? officialMapAreaPreviewShell(initialChangeArea) : null,
  );
  const [officialAreaId, setOfficialAreaId] = useState<string | null>(
    initialChangeArea?.areaId ?? null,
  );
  const [coveringStatus, setCoveringStatus] = useState<OfficialLoadStatus | "loading">("loading");
  const [discovery, setDiscovery] = useState<MapDiscoveryRunPayload | null>(null);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialRunId);
  const appliedChangeRef = useRef(false);
  const officialFetchGenRef = useRef(0);

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

  const coveringFromCache = selected?.id
    ? peekCachedValue<OfficialCoveringGeojson>("covering", selected.id)
    : null;
  const covering = coveringFromCache ??
    (selected?.id && fetchedCovering?.projectId === selected.id ? fetchedCovering.covering : null);
  const coveringStatusResolved: OfficialLoadStatus | "loading" = coveringFromCache
    ? "available"
    : selected?.id && fetchedCovering?.projectId === selected.id
      ? coveringStatus
      : selected?.id
        ? "loading"
        : "available";
  const selectedOpportunity =
    selectedOpportunitySlug ? (opportunities.find((item) => item.slug === selectedOpportunitySlug) ?? null) : null;
  const activeDiscovery = selectedRunId && discovery?.runId === selectedRunId ? discovery : null;
  const selectedCandidate =
    selectedCandidateId && activeDiscovery
      ? (activeDiscovery.candidates.find((item) => item.id === selectedCandidateId) ?? null)
      : null;
  const searchArea: MapSearchArea | null =
    activeDiscovery &&
    activeDiscovery.west != null &&
    activeDiscovery.south != null &&
    activeDiscovery.east != null &&
    activeDiscovery.north != null
      ? {
          id: activeDiscovery.searchId,
          searchId: activeDiscovery.searchId,
          name: activeDiscovery.searchName,
          west: activeDiscovery.west,
          south: activeDiscovery.south,
          east: activeDiscovery.east,
          north: activeDiscovery.north,
        }
      : null;
  const opportunityFootprints = useMemo(
    () => opportunityFootprintsCollection(opportunities),
    [opportunities],
  );
  const discoveryPending = Boolean(selectedRunId) && !discoveryError && discovery?.runId !== selectedRunId;
  const missingSelectedRun =
    Boolean(selectedRunId) && !discoverySearches.some((item) => item.latestRunId === selectedRunId);

  useEffect(() => {
    if (!selected?.id) return;
    const projectId = selected.id;
    if (peekCachedValue<OfficialCoveringGeojson>("covering", projectId)) return;
    let cancelled = false;
    loadOfficialCoveringAction(projectId).then((result) => {
      if (cancelled) return;
      setCoveringStatus(result.status);
      setFetchedCovering({ projectId, covering: result.covering });
      if (result.ok) {
        setCachedValue("covering", projectId, result.covering);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  const originOpportunity = selected
    ? (opportunities.find((item) => item.promotedProjectId === selected.id) ?? null)
    : null;

  const persistMapUrl = useCallback(
    (next: {
      run?: string | null;
      project?: string | null;
      opportunity?: string | null;
      candidate?: string | null;
    }) => {
      const params = new URLSearchParams(window.location.search);
      const change = params.get("change");
      const merged = {
        run: next.run === undefined ? selectedRunId : next.run,
        project: next.project === undefined ? selectedSlug : next.project,
        opportunity: next.opportunity === undefined ? selectedOpportunitySlug : next.opportunity,
        candidate: next.candidate === undefined ? selectedCandidateId : next.candidate,
      };
      const nextParams = new URLSearchParams();
      if (change) nextParams.set("change", change);
      if (merged.run) nextParams.set("run", merged.run);
      if (merged.project) nextParams.set("project", merged.project);
      if (merged.opportunity) nextParams.set("opportunity", merged.opportunity);
      if (merged.candidate) nextParams.set("candidate", merged.candidate);
      const query = nextParams.toString();
      const target = query ? `/map?${query}` : "/map";
      const current = `${window.location.pathname}${window.location.search}`;
      if (current === target) return;
      router.replace(target, { scroll: false });
    },
    [router, selectedRunId, selectedSlug, selectedOpportunitySlug, selectedCandidateId],
  );

  const toggleChrome = useCallback((panel: "filters" | "layers" | "legend" | "projects") => {
    setChromePanel((current) => (current === panel ? null : panel));
  }, []);

  const selectProject = useCallback(
    (slug: string) => {
      setSelectedSlug(slug);
      setSelectedOpportunitySlug(null);
      setSelectedCandidateId(null);
      setOfficialAreaId(null);
      setOfficialContext(null);
      setOfficialPreview(null);
      persistMapUrl({ project: slug, opportunity: null, candidate: null });
    },
    [persistMapUrl],
  );

  const selectOpportunity = useCallback(
    (slug: string) => {
      setSelectedOpportunitySlug(slug);
      setSelectedSlug(null);
      setSelectedCandidateId(null);
      setOfficialAreaId(null);
      setOfficialContext(null);
      setOfficialPreview(null);
      persistMapUrl({ opportunity: slug, project: null, candidate: null });
    },
    [persistMapUrl],
  );

  const selectCandidate = useCallback(
    (id: string) => {
      setSelectedCandidateId(id);
      setSelectedSlug(null);
      setSelectedOpportunitySlug(null);
      setOfficialAreaId(null);
      setOfficialContext(null);
      setOfficialPreview(null);
      persistMapUrl({ candidate: id, project: null, opportunity: null });
    },
    [persistMapUrl],
  );

  const loadDiscovery = useCallback(
    (search: MapDiscoverySearch) => {
      if (!search.latestRunId || !isCompletedDiscoveryRun(search.latestRunStatus)) {
        setDiscoveryError("Select a completed screening run.");
        return;
      }
      setDiscoveryError(null);
      setSelectedRunId(search.latestRunId);
      setSelectedCandidateId(null);
      setSelectedSlug(null);
      setSelectedOpportunitySlug(null);
      persistMapUrl({
        run: search.latestRunId,
        candidate: null,
        project: null,
        opportunity: null,
      });
    },
    [persistMapUrl],
  );

  const clearDiscovery = useCallback(() => {
    setSelectedRunId(null);
    setDiscovery(null);
    setSelectedCandidateId(null);
    persistMapUrl({ run: null, candidate: null });
  }, [persistMapUrl]);

  useEffect(() => {
    if (!selectedRunId) return;
    const search = discoverySearches.find((item) => item.latestRunId === selectedRunId);
    if (!search) return;
    let cancelled = false;
    loadMapDiscoveryRunAction(search.searchId, selectedRunId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setDiscovery(null);
        setDiscoveryError(result.error);
        return;
      }
      setDiscoveryError(null);
      setDiscovery(result.payload);
      setLayers((current) => ({ ...current, searchAreas: true, candidateSites: true }));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedRunId, discoverySearches]);

  const selectOfficial = useCallback(
    (input: OfficialMapAreaPreview) => {
      const generation = (officialFetchGenRef.current += 1);
      setOfficialPreview(input);
      setOfficialAreaId(input.areaId);
      setSelectedSlug(null);
      setSelectedOpportunitySlug(null);
      setSelectedCandidateId(null);
      persistMapUrl({ project: null, opportunity: null, candidate: null });
      const cached = getCachedValue<OfficialMapAreaContext>("area", input.areaId);
      if (cached) {
        setOfficialContext(cached);
        setOfficialLoading(false);
        return;
      }
      setOfficialContext(null);
      setOfficialLoading(true);
      loadOfficialMapAreaContextAction(input.areaId)
        .then((result) => {
          if (generation !== officialFetchGenRef.current) return;
          setOfficialLoading(false);
          if (result.ok) {
            setCachedValue("area", input.areaId, result.context);
            setOfficialContext(result.context);
          }
        })
        .catch(() => {
          if (generation !== officialFetchGenRef.current) return;
          setOfficialLoading(false);
        });
    },
    [persistMapUrl],
  );

  useEffect(() => {
    if (appliedChangeRef.current || !initialChangeArea?.areaId) return;
    appliedChangeRef.current = true;
    setLayers((current) => ({
      ...current,
      localNetwork: initialChangeArea.layer === "local_network" ? true : current.localNetwork,
      planningArea: initialChangeArea.layer === "planning_area" ? true : current.planningArea,
    }));
    selectOfficial(officialMapAreaPreviewShell(initialChangeArea));
  }, [initialChangeArea, selectOfficial]);

  const emptyPortfolio = projects.length === 0 && opportunities.length === 0 && !activeDiscovery;
  const showDetail = !panelsHidden;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {panelsHidden ? null : (
        <div className="flex min-h-[2.75rem] shrink-0 items-center gap-2 border-b border-line bg-canvas px-3 py-1.5">
          <div className="min-w-0 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Discover</p>
            <h1 className="text-base font-semibold leading-5">Map</h1>
          </div>
          <Link href="/opportunities/new" data-testid="map-new-search" className="shrink-0">
            <Button className="h-8 px-3 text-xs">New search</Button>
          </Link>
          <div className="min-w-0 flex-1 overflow-hidden">
          <MapDiscoveryControl
            searches={discoverySearches}
            selectedRunId={selectedRunId}
            loading={discoveryPending}
            error={
              missingSelectedRun
                ? "That screening run is not in recent searches."
                : discoveryError
            }
            onSelect={loadDiscovery}
            onClear={clearDiscovery}
          />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <MapToolbarToggle
              pressed={chromePanel === "filters"}
              onClick={() => toggleChrome("filters")}
              testId="map-filters-toggle"
            >
              Filters
            </MapToolbarToggle>
            <MapToolbarToggle
              pressed={chromePanel === "layers"}
              onClick={() => toggleChrome("layers")}
            >
              Layers
            </MapToolbarToggle>
            <MapToolbarToggle
              pressed={chromePanel === "legend"}
              onClick={() => toggleChrome("legend")}
            >
              Legend
            </MapToolbarToggle>
            <MapToolbarToggle
              pressed={chromePanel === "projects"}
              onClick={() => toggleChrome("projects")}
            >
              Projects
            </MapToolbarToggle>
            <Button
              variant="ghost"
              onClick={() => {
                setChromePanel(null);
                setPanelsHidden(true);
              }}
              data-testid="map-hide-panels"
              className="h-8 px-2.5 text-xs"
            >
              <Maximize2 size={14} />
              Hide panels
            </Button>
            <Button
              variant="ghost"
              onClick={() => setCompareOpen(true)}
              disabled={compared.length === 0}
              className="h-8 px-2.5 text-xs"
            >
              Compare ({compared.length}/4)
            </Button>
            <BellButton />
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
        <SwedenMap
          projects={mapped}
          opportunities={opportunities}
          selectedId={visibleSelectedSlug}
          selectedOpportunitySlug={selectedOpportunitySlug}
          selectedCandidateId={selectedCandidateId}
          layers={layers}
          localNetwork={localNetwork}
          planningArea={planningArea}
          covering={selected ? covering : null}
          highlightAreaId={officialAreaId}
          highlightLayer={officialPreview?.layer ?? initialChangeArea?.layer}
          discoveryGeojson={activeDiscovery?.geojson ?? EMPTY_DISCOVERY_GEOJSON}
          searchArea={searchArea}
          opportunityFootprints={opportunityFootprints}
          discoveryFitKey={activeDiscovery?.runId ?? null}
          discoveryLoading={discoveryPending}
          fitPadding={
            panelsHidden
              ? 40
              : {
                  top: 16,
                  right: showDetail && (selected || selectedOpportunity || selectedCandidate || officialPreview) ? 320 : 48,
                  bottom: 40,
                  left: chromePanel ? 280 : 48,
                }
          }
          onSelectProject={selectProject}
          onSelectOpportunity={selectOpportunity}
          onSelectCandidate={selectCandidate}
          onSelectOfficial={selectOfficial}
        />
        </div>

        {panelsHidden ? (
          <button
            type="button"
            onClick={() => setPanelsHidden(false)}
            className="absolute left-3 top-3 z-20 flex items-center gap-1 rounded-md border border-line bg-surface px-2 py-2 text-xs text-muted hover:text-ink"
          >
            <Minimize2 size={14} />
            Show panels
          </button>
        ) : chromePanel === "layers" ? (
          <div className="absolute left-3 top-3 z-10">
            <MapLayerControl
              layers={layers}
              onChange={setLayers}
              onCollapse={() => setChromePanel(null)}
              hasDiscoveryRun={Boolean(activeDiscovery)}
            />
          </div>
        ) : chromePanel === "legend" ? (
          <div className="absolute left-3 top-3 z-10">
            <MapLegend
              hasDiscoveryRun={Boolean(activeDiscovery)}
              showZones={layers.opportunityZones}
              showNup={layers.planningArea}
              showProjects={layers.projects}
              showOpportunities={layers.opportunities}
            />
          </div>
        ) : chromePanel === "filters" ? (
          <section className="absolute left-3 top-3 z-10 max-h-[calc(100%-1.5rem)] w-[18rem] overflow-auto rounded-md border border-line bg-surface p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">Project filters</p>
              <button type="button" onClick={() => setChromePanel(null)} className="text-xs text-muted hover:text-ink">
                Close
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-2">
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
                labels={{
                  All: "All",
                  ...Object.fromEntries(OUTLOOKS.map((outlook) => [outlook, formatOutlookLabel(outlook)])),
                }}
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
              <Button
                variant="ghost"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setUnmatchedOnly(false);
                }}
                disabled={!filtersActive}
                className="h-8 text-xs"
              >
                Reset filters
              </Button>
            </div>
            <div className="mt-3">
              <MapSpatialSummary
                summary={spatialSummary}
                unmatchedActive={unmatchedOnly}
                onToggleUnmatched={() => setUnmatchedOnly((current) => !current)}
                matchesStatus={officialStatus.matches}
                localNetworkStatus={officialStatus.localNetwork}
              />
            </div>
          </section>
        ) : chromePanel === "projects" ? (
          <section className="absolute left-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] w-[16.5rem] flex-col overflow-hidden rounded-md border border-line bg-surface">
            <div className="flex items-start justify-between gap-2 border-b border-line px-3 py-2">
              <div>
                <p className="text-xs font-medium">Projects</p>
                <p className="mt-0.5 text-[11px] leading-4 text-muted">
                  Circles. Ring colour is team outlook, not capacity.
                </p>
              </div>
              <button type="button" onClick={() => setChromePanel(null)} className="text-xs text-muted hover:text-ink">
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-1 py-1">
              {filtered.length === 0 ? (
                <p className="px-2 py-2 text-xs text-muted">No projects match these filters.</p>
              ) : (
                filtered.map((project) => (
                  <button
                    key={project.slug}
                    type="button"
                    onClick={() => selectProject(project.slug)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-canvas",
                      visibleSelectedSlug === project.slug && "bg-canvas",
                    )}
                  >
                    <span
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 bg-canvas"
                      style={{ borderColor: markerColor(project.outlook) }}
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
          </section>
        ) : null}

        {mapped.length === 0 && filtersActive ? (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
            <div className="pointer-events-auto rounded-md border border-line bg-surface px-3 py-2 text-xs text-muted">
              No projects match these project filters.
            </div>
          </div>
        ) : emptyPortfolio ? (
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs">
            <span className="text-muted">Search a development area</span>
            <Link href="/opportunities/new">
              <Button className="h-7 px-2 text-xs">New search</Button>
            </Link>
          </div>
        ) : activeDiscovery && activeDiscovery.candidateCount === 0 ? (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
            <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs text-muted">
              This screening run has no Candidate Sites.
            </div>
          </div>
        ) : officialStatus.localNetwork === "unavailable" ? (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
            <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs text-muted" data-testid="map-official-empty">
              Official local-network layer is currently unavailable. This is not a no-match result.
            </div>
          </div>
        ) : null}

        {showDetail && officialPreview && officialAreaId ? (
          <MapOfficialPanel
            preview={officialPreview}
            context={officialContext}
            loading={officialLoading}
            fromPublishedChange={Boolean(initialChangeArea?.areaId && officialAreaId === initialChangeArea.areaId)}
            onClose={() => {
              setOfficialAreaId(null);
              setOfficialContext(null);
              setOfficialPreview(null);
            }}
          />
        ) : showDetail && selectedCandidate && activeDiscovery ? (
          <MapCandidatePanel
            candidate={selectedCandidate}
            searchId={activeDiscovery.searchId}
            runId={activeDiscovery.runId}
            providerAvailability={activeDiscovery.providerAvailability}
            onClose={() => {
              setSelectedCandidateId(null);
              persistMapUrl({ candidate: null });
            }}
          />
        ) : showDetail && selectedOpportunity ? (
          <MapOpportunityPanel
            item={selectedOpportunity}
            onClose={() => {
              setSelectedOpportunitySlug(null);
              persistMapUrl({ opportunity: null });
            }}
          />
        ) : showDetail && selected ? (
          <MapProjectPanel
            project={selected}
            originOpportunity={originOpportunity}
            location={locationLabel(selected)}
            match={matchByProjectId.get(selected.id)}
            covering={covering}
            coveringStatus={coveringStatusResolved === "loading" ? "available" : coveringStatusResolved}
            matchesStatus={officialStatus.matches}
            coveringLoading={coveringStatusResolved === "loading"}
            onClose={() => {
              setSelectedSlug(null);
              persistMapUrl({ project: null });
            }}
            onAddToCompare={() => {
              addToCompare(selected.slug, selected.name);
              setCompareOpen(true);
            }}
            compareDisabled={compareIds.includes(selected.slug)}
          />
        ) : null}
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
    </div>
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

function Select({
  value,
  onChange,
  options,
  label,
  labels,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label: string;
  labels?: Record<string, string>;
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
            {labels?.[option] ?? option}
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
