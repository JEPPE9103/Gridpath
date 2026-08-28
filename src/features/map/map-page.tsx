"use client";

import { BellButton } from "@/components/layout/app-shell";
import { ConfidenceBadge, OutlookBadge, StageBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { markerColor, STYLE } from "@/features/map/mini-map";
import { cn } from "@/lib/cn";
import type { MapProject, MapProjectsResult } from "@/lib/data/map-types";
import { OVERVIEW_PIPELINE_STAGES, type OverviewPipelineStage } from "@/lib/data/overview-types";
import {
  rankingExplanation,
  strongestDevelopmentProfile,
  formatFactorPoints,
} from "@/lib/domain/development-profile";
import { ClientHeaderDate } from "@/components/ui/client-header-date";
import { useWorkspace } from "@/lib/workspace-state";
import {
  OUTLOOKS,
  TECHNOLOGIES,
  type Confidence,
  type Outlook,
  type Technology,
} from "@/types";
import { Map, Marker, NavigationControl } from "maplibre-gl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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

export function MapPage({ result }: { result: MapProjectsResult }) {
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
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="No projects in this workspace"
            description="Add a project to the portfolio to place it on Map & Compare."
          />
        </div>
      </>
    );
  }

  return <LoadedMapPage projects={result.projects} />;
}

function LoadedMapPage({ projects }: { projects: MapProject[] }) {
  const { compareIds, addToCompare, removeFromCompare, clearCompare } = useWorkspace();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(false);
  const [detailCollapsed, setDetailCollapsed] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const operators = useMemo(
    () => ["All", ...new Set(projects.map((project) => project.gridOperator).filter(Boolean))].sort(),
    [projects],
  );

  const filtered = useMemo(
    () => projects.filter((project) => matchesFilters(project, filters)),
    [projects, filters],
  );
  const mapped = useMemo(() => filtered.filter(isPlottable), [filtered]);
  const ungeocoded = useMemo(
    () => filtered.filter((project) => !isPlottable(project)),
    [filtered],
  );

  const visibleSelectedSlug =
    selectedSlug && filtered.some((project) => project.slug === selectedSlug) ? selectedSlug : null;
  const selected = visibleSelectedSlug
    ? (projects.find((project) => project.slug === visibleSelectedSlug) ?? null)
    : null;
  const compared = projects.filter((project) => compareIds.includes(project.slug));
  const strongest = strongestDevelopmentProfile(compared);
  const filtersActive = hasActiveFilters(filters);

  return (
    <>
      <PageHeader
        title="Map & Compare"
        subtitle="Portfolio map · your development projects across the portfolio"
        actions={
          <>
            <Button variant="secondary" onClick={() => setCompareOpen(true)} disabled={compared.length === 0}>
              Compare ({compared.length}/4)
            </Button>
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
          <Button variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)} disabled={!filtersActive}>
            Reset filters
          </Button>
        </div>

        <div className="relative h-[calc(100dvh-14.5rem)] min-h-[360px] overflow-hidden rounded-md border border-line bg-surface sm:h-[calc(100vh-220px)] sm:min-h-[520px]">
          <SwedenMap projects={mapped} selectedId={visibleSelectedSlug} onSelect={setSelectedSlug} />

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

          {selected && !detailCollapsed ? (
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
            Customer / project data · team outlook markers
            <span className="mx-2 text-muted">|</span>
            Portfolio comparison · development triage ranking
            <span className="mx-2 text-muted">|</span>
            Official Ei Grid Intelligence · on each project Grid tab
          </p>
          <p className="text-xs leading-5 text-muted">
            Map colours and compare ranking use customer-entered and workflow fields for portfolio
            triage. They are not an official grid score or capacity assessment. Official local-network
            and NUP context live on the project Grid Intelligence tab.
          </p>
        </div>
      </div>

      {compareOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div>
              <h2 className="text-base font-semibold">
                Portfolio comparison ({compared.length}/4)
              </h2>
              <p className="text-xs text-muted">{rankingExplanation()}</p>
              <p className="mt-1 text-xs text-muted">
                Compare selection is saved in this browser only — not shared with your team.
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
          {compared.length === 0 ? (
            <p className="px-4 pb-6 text-sm text-muted sm:px-6 lg:px-8">
              Select up to four sites from the map to compare development profiles.
            </p>
          ) : (
            <div className="overflow-x-auto px-4 pb-6 sm:px-6 lg:px-8">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-4 font-medium">Field</th>
                    {compared.map((project) => (
                      <th key={project.slug} className="py-2 pr-4 font-medium text-ink">
                        <div className="flex items-start justify-between gap-2">
                          <Link href={`/projects/${project.slug}`} className="hover:text-teal">
                            {project.name}
                          </Link>
                          <button type="button" onClick={() => removeFromCompare(project.slug)}>
                            <X size={12} />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <CompareRow label="Location" values={compared.map((p) => locationLabel(p))} />
                  <CompareRow label="Technology" values={compared.map((p) => p.technology)} />
                  <CompareRow
                    label="Import MW"
                    values={compared.map((p) => `${p.importMW} MW`)}
                  />
                  <CompareRow
                    label="Export MW"
                    values={compared.map((p) => `${p.exportMW} MW`)}
                  />
                  <CompareRow
                    label="Grid operator"
                    values={compared.map((p) => p.gridOperator || "—")}
                  />
                  <CompareRow
                    label="Team outlook"
                    values={compared.map((p) => <OutlookBadge key={p.slug} outlook={p.outlook} />)}
                  />
                  <CompareRow
                    label="Team confidence"
                    values={compared.map((p) => (
                      <ConfidenceBadge key={p.slug} confidence={p.confidence} />
                    ))}
                  />
                  <CompareRow
                    label="Connection stage"
                    values={compared.map((p) => p.stage)}
                  />
                  <CompareRow
                    label="Application readiness"
                    values={compared.map((p) => readinessLabel(p.readinessPercent))}
                  />
                  <CompareRow label="Target COD" values={compared.map((p) => p.targetCOD || "—")} />
                  <CompareRow
                    label="Development profile score"
                    values={compared.map((p) => `${p.developmentProfile.score} pts`)}
                  />
                  <CompareRow
                    label="Open alerts / attention"
                    values={compared.map((p) => attentionLabel(p))}
                  />
                  <CompareRow
                    label="Next connection milestone"
                    values={compared.map((p) => milestoneLabel(p))}
                  />
                </tbody>
              </table>
              <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                {compared.map((project) => (
                  <div
                    key={project.slug}
                    className="rounded-md border border-line bg-canvas px-4 py-3 text-sm"
                  >
                    <p className="font-medium text-ink">{project.name}</p>
                    <p className="mt-1 text-xs text-muted">
                      Development profile · {project.developmentProfile.score} pts
                    </p>
                    <ul className="mt-2 space-y-0.5 text-ink">
                      {project.developmentProfile.factors.map((factor) => (
                        <li key={`${project.slug}-${factor.key}`} className="flex justify-between gap-2">
                          <span>{factor.label}</span>
                          <span className="shrink-0 font-mono text-xs text-muted">
                            {formatFactorPoints(factor.points)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {strongest ? (
                <div className="mt-4 rounded-md border border-line bg-teal-soft px-4 py-3 text-sm">
                  <p className="font-medium text-teal">Strongest current development profile</p>
                  <p className="mt-1 text-ink">
                    {strongest.name} · {strongest.developmentProfile.score} pts
                  </p>
                  <ul className="mt-2 space-y-0.5 text-ink">
                    {strongest.developmentProfile.factors.map((factor) => (
                      <li key={factor.key}>
                        {formatFactorPoints(factor.points)} · {factor.label}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted">
                    Stored project and workflow data only. Not a guarantee of connection or available
                    capacity.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

function SwedenMap({
  projects,
  selectedId,
  onSelect,
}: {
  projects: MapProject[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new Map({
      container: containerRef.current,
      style: STYLE,
      center: [16.2, 62.2],
      zoom: 4.35,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-left");
    mapRef.current = map;
    map.once("load", () => setMapReady(true));
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const markers: Marker[] = [];

    for (const project of projects) {
      const el = document.createElement("button");
      el.type = "button";
      el.style.width = selectedId === project.slug ? "18px" : "14px";
      el.style.height = selectedId === project.slug ? "18px" : "14px";
      el.style.borderRadius = "999px";
      el.style.background = markerColor(project.outlook);
      el.style.border = "2px solid white";
      el.style.boxShadow =
        selectedId === project.slug
          ? "0 0 0 3px rgba(42,122,111,0.35)"
          : "0 0 0 1px rgba(26,30,36,0.2)";
      el.style.cursor = "pointer";
      el.title = project.name;
      el.onclick = () => onSelect(project.slug);
      markers.push(
        new Marker({ element: el })
          .setLngLat([project.longitude, project.latitude])
          .addTo(map),
      );
    }

    return () => {
      markers.forEach((marker) => marker.remove());
    };
  }, [projects, selectedId, onSelect, mapReady]);

  return <div ref={containerRef} className="h-full w-full" />;
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

function attentionLabel(project: MapProject): string {
  const attention = project.openAlerts.filter(
    (alert) => alert.severity === "critical" || alert.severity === "warning",
  );
  if (attention.length === 0) {
    return "None recorded";
  }
  return attention.map((alert) => alert.title).join("; ");
}

function milestoneLabel(project: MapProject): string {
  if (!project.connectionCase) {
    return "No connection case";
  }
  return project.connectionCase.nextMilestone?.trim() || "—";
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

function CompareRow({ label, values }: { label: string; values: ReactNode[] }) {
  return (
    <tr className="border-b border-line align-top">
      <td className={cn("py-2 pr-4 font-medium text-muted")}>{label}</td>
      {values.map((value, index) => (
        <td key={index} className="py-2 pr-4">
          {value}
        </td>
      ))}
    </tr>
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
