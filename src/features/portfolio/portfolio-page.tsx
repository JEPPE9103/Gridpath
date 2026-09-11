"use client";

import { BellButton } from "@/components/layout/app-shell";
import { ConfidenceBadge, OutlookBadge, StageBadge } from "@/components/ui/badges";
import { Button, buttonClassName } from "@/components/ui/button";
import { EmptyState, EmptyProjectsAction, ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ClientHeaderDate } from "@/components/ui/client-header-date";
import {
  AttentionDot,
  FilterBar,
  FilterSelect,
  PageBody,
  tableBodyRowClass,
  tableCellClass,
  tableHeadCellClass,
  tableHeadClass,
  tableNumericClass,
  tableWrapClass,
} from "@/components/ui/workspace";
import { formatCapacity, formatDate, formatMWTotal, formatOutlookLabel } from "@/lib/format";
import { attentionBandLabel } from "@/lib/intelligence";
import type { ListProjectsResult, PortfolioSortKey } from "@/lib/data/projects";
import { PORTFOLIO_PAGE_SIZE } from "@/lib/data/paged-select";
import {
  EMPTY_OVERVIEW_DESCRIPTION,
  EMPTY_OVERVIEW_TITLE,
} from "@/lib/opportunities/evidence-coverage";
import type { ArchiveView } from "@/lib/projects/archive-scope";
import {
  OUTLOOKS,
  PIPELINE_STAGES,
  TECHNOLOGIES,
} from "@/types";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function PortfolioPage({
  result,
  activeCount,
  archivedCount,
  activeMw,
  blockedByRls,
  error,
  canCreate,
  canImport,
}: {
  result: ListProjectsResult;
  activeCount: number;
  archivedCount: number;
  activeMw: number;
  blockedByRls: boolean;
  error: string | null;
  canCreate: boolean;
  canImport: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(result.query);
  const pageCount = Math.max(1, Math.ceil(result.matchingCount / result.pageSize));
  const from = result.matchingCount === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.page * result.pageSize, result.matchingCount);
  const filtersActive =
    Boolean(result.query) ||
    result.technology !== "All" ||
    result.operator !== "All" ||
    result.stage !== "All" ||
    result.outlook !== "All" ||
    result.attentionFilter !== "all" ||
    result.sortKey === "attention";
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(filtersActive);
  const [filtersWereActive, setFiltersWereActive] = useState(filtersActive);
  if (filtersActive !== filtersWereActive) {
    setFiltersWereActive(filtersActive);
    if (filtersActive) {
      setMoreFiltersOpen(true);
    }
  }

  function href(overrides: Record<string, string | null | undefined>): string {
    const params = new URLSearchParams();
    const next = {
      view: result.view,
      q: result.query,
      technology: result.technology === "All" ? "" : result.technology,
      operator: result.operator === "All" ? "" : result.operator,
      stage: result.stage === "All" ? "" : result.stage,
      outlook: result.outlook === "All" ? "" : result.outlook,
      attention: result.attentionFilter === "all" ? "" : result.attentionFilter,
      sort: result.sortKey,
      dir: result.sortDir,
      page: String(result.page),
      ...overrides,
    };
    for (const [key, value] of Object.entries(next)) {
      if (value && value !== "All" && !(key === "page" && value === "1") && !(key === "view" && value === "active") && !(key === "sort" && value === "lastUpdated") && !(key === "dir" && value === "desc") && !(key === "attention" && value === "all")) {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function update(overrides: Record<string, string | null | undefined>) {
    router.push(href({ ...overrides, page: overrides.page ?? "1" }));
  }

  function toggleSort(key: PortfolioSortKey) {
    if (result.sortKey === key) {
      update({ sort: key, dir: result.sortDir === "asc" ? "desc" : "asc" });
    } else {
      update({
        sort: key,
        dir: key === "name" || key === "location" ? "asc" : "desc",
      });
    }
  }

  const subtitle = useMemo(() => {
    const mw = activeMw > 0 ? formatMWTotal(activeMw) : "requested MW not set";
    const active = `${activeCount} active · ${mw}`;
    if (result.view === "archived") {
      return `${archivedCount} archived · ${active}`;
    }
    if (result.view === "all") {
      return `${activeCount + archivedCount} total · ${active}`;
    }
    return active;
  }, [activeCount, activeMw, archivedCount, result.view]);

  return (
    <>
      <PageHeader
        eyebrow="Develop"
        title="Portfolio"
        subtitle={`${subtitle} · requested MW is customer-entered`}
        actions={
          <>
            {canImport ? (
              <Link href="/portfolio/import" className={buttonClassName("secondary")}>
                Import projects
              </Link>
            ) : null}
            {canCreate ? (
              <Link href="/projects/new" className={buttonClassName()}>
                Add project
              </Link>
            ) : null}
            <BellButton />
            <ClientHeaderDate />
          </>
        }
      />
      <PageBody className="space-y-4">
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: query, page: "1" });
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-line bg-surface p-0.5 text-sm">
              {(["active", "archived", "all"] as ArchiveView[]).map((view) => (
                <Link
                  key={view}
                  href={href({ view, page: "1" })}
                  className={
                    result.view === view
                      ? "rounded px-2.5 py-1 font-medium text-ink bg-canvas"
                      : "rounded px-2.5 py-1 text-muted hover:text-ink"
                  }
                >
                  {view === "active" ? "Active" : view === "archived" ? "Archived" : "All"}
                </Link>
              ))}
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search project or location"
              className="h-9 min-w-[12rem] flex-1 rounded-md border border-line bg-surface px-3 text-sm sm:max-w-xs"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </div>
          <details
            className="group"
            open={moreFiltersOpen}
            onToggle={(event) => setMoreFiltersOpen(event.currentTarget.open)}
          >
            <summary className="cursor-pointer list-none text-sm font-medium text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-1">
                More filters
                {filtersActive ? <span className="font-normal">· applied</span> : null}
              </span>
            </summary>
            <FilterBar>
          <FilterSelect
            value={result.technology}
            onChange={(value) => update({ technology: value === "All" ? "" : value, page: "1" })}
            options={["All", ...TECHNOLOGIES]}
            label="Technology"
          />
          <FilterSelect
            value={result.operator}
            onChange={(value) => update({ operator: value === "All" ? "" : value, page: "1" })}
            options={["All", ...result.operators]}
            label="Operator"
          />
          <FilterSelect
            value={result.stage}
            onChange={(value) => update({ stage: value === "All" ? "" : value, page: "1" })}
            options={["All", ...PIPELINE_STAGES]}
            label="Stage"
          />
          <FilterSelect
            value={result.outlook}
            onChange={(value) => update({ outlook: value === "All" ? "" : value, page: "1" })}
            options={["All", ...OUTLOOKS]}
            labels={{
              All: "All",
              ...Object.fromEntries(OUTLOOKS.map((outlook) => [outlook, formatOutlookLabel(outlook)])),
            }}
            label="Team outlook"
          />
          <FilterSelect
            value={result.attentionFilter}
            onChange={(value) => update({ attention: value === "all" ? "" : value, page: "1" })}
            options={["all", "action", "needs_attention", "official_changes"]}
            labels={{
              all: "All",
              action: "Action required",
              needs_attention: "Action or watch",
              official_changes: "Official changes",
            }}
            label="Attention"
          />
          <FilterSelect
            value={result.sortKey === "attention" ? "attention" : "default"}
            onChange={(value) =>
              update({
                sort: value === "attention" ? "attention" : "lastUpdated",
                dir: value === "attention" ? "asc" : "desc",
                page: "1",
              })
            }
            options={["default", "attention"]}
            labels={{ default: "Last update", attention: "Attention first" }}
            label="Sort"
          />
            </FilterBar>
          </details>
        </form>
        <p className="text-sm text-muted">
          {result.matchingCount === 0
            ? "No matching projects"
            : `Showing ${from}–${to} of ${result.matchingCount} matching · page ${result.page} of ${pageCount} · ${PORTFOLIO_PAGE_SIZE} per page`}
        </p>

        {blockedByRls ? (
          <ErrorState
            title="Could not load projects"
            description="Sign in to a workspace to view the organisation portfolio."
          />
        ) : error ? (
          <ErrorState title="Could not load projects" description={error} />
        ) : result.matchingCount === 0 && !result.query && result.technology === "All" && result.operator === "All" && result.stage === "All" && result.outlook === "All" && result.attentionFilter === "all" ? (
          <EmptyState
            title={result.view === "archived" ? "No archived projects" : EMPTY_OVERVIEW_TITLE}
            description={
              result.view === "archived"
                ? "Archived projects will appear here. Active projects remain in the Active view."
                : EMPTY_OVERVIEW_DESCRIPTION
            }
            action={
              canCreate && result.view === "active" ? <EmptyProjectsAction /> : undefined
            }
          />
        ) : result.projects.length === 0 ? (
          <EmptyState
            title="No projects match these filters"
            description="Clear search or filters to see all projects in this workspace."
          />
        ) : (
          <div className={tableWrapClass}>
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <Th onClick={() => toggleSort("name")} active={result.sortKey === "name"} dir={result.sortDir}>
                    Project
                  </Th>
                  <Th onClick={() => toggleSort("location")} active={result.sortKey === "location"} dir={result.sortDir}>
                    Location
                  </Th>
                  <Th onClick={() => toggleSort("technology")} active={result.sortKey === "technology"} dir={result.sortDir}>
                    Technology
                  </Th>
                  <Th onClick={() => toggleSort("capacity")} active={result.sortKey === "capacity"} dir={result.sortDir}>
                    Requested MW
                  </Th>
                  <Th onClick={() => toggleSort("gridOperator")} active={result.sortKey === "gridOperator"} dir={result.sortDir}>
                    Grid Operator
                  </Th>
                  <Th onClick={() => toggleSort("stage")} active={result.sortKey === "stage"} dir={result.sortDir}>
                    Stage
                  </Th>
                  <Th>Next action</Th>
                  <Th>Team outlook</Th>
                  <Th onClick={() => toggleSort("lastUpdated")} active={result.sortKey === "lastUpdated"} dir={result.sortDir}>
                    Last update
                  </Th>
                </tr>
              </thead>
              <tbody>
                {result.projects.map((project) => (
                  <tr
                    key={project.projectId}
                    className={`${tableBodyRowClass} cursor-pointer`}
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <td className={`${tableCellClass} font-medium`}>
                      <span className="inline-flex items-center gap-2">
                        <AttentionDot band={project.attentionBand} />
                        {project.name}
                      </span>
                      {project.attentionBand && project.attentionBand !== "clear" ? (
                        <p className="mt-0.5 pl-4 text-[11px] text-muted">
                          {attentionBandLabel(project.attentionBand)}
                          {(project.unreviewedOfficialChangeCount ?? 0) > 0
                            ? ` · ${project.unreviewedOfficialChangeCount} official change${project.unreviewedOfficialChangeCount === 1 ? "" : "s"}`
                            : ""}
                        </p>
                      ) : null}
                      {project.archivedAt ? (
                        <span className="ml-2 text-xs font-normal text-muted">Archived</span>
                      ) : null}
                    </td>
                    <td className={`${tableCellClass} text-muted`}>{project.location}</td>
                    <td className={tableCellClass}>{project.technology}</td>
                    <td className={tableNumericClass}>
                      <span className={project.importMW <= 0 && project.exportMW <= 0 ? "font-sans text-muted" : undefined}>
                        {formatCapacity(project)}
                      </span>
                    </td>
                    <td className={tableCellClass}>{project.gridOperator}</td>
                    <td className={tableCellClass}>
                      <StageBadge stage={project.stage} />
                      {project.daysInCurrentStage != null ? (
                        <p className="mt-1 text-xs text-muted">{project.daysInCurrentStage} days in stage</p>
                      ) : null}
                    </td>
                    <td className={`${tableCellClass} text-muted`}>
                      {project.nextActionTitle ?? "—"}
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex flex-wrap items-center gap-1">
                        <OutlookBadge outlook={project.outlook} />
                        <ConfidenceBadge confidence={project.confidence} />
                      </div>
                    </td>
                    <td className={`${tableCellClass} whitespace-nowrap text-muted`}>{formatDate(project.lastUpdated)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={href({ page: String(Math.max(1, result.page - 1)) })}
              className={buttonClassName("secondary")}
              aria-disabled={result.page <= 1}
            >
              Previous
            </Link>
            <span className="text-sm text-muted">
              Page {result.page} of {pageCount}
            </span>
            <Link
              href={href({ page: String(Math.min(pageCount, result.page + 1)) })}
              className={buttonClassName("secondary")}
              aria-disabled={result.page >= pageCount}
            >
              Next
            </Link>
          </div>
        ) : null}
      </PageBody>
    </>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
}: {
  children: string;
  onClick?: () => void;
  active?: boolean;
  dir?: "asc" | "desc";
}) {
  if (!onClick) {
    return <th className={tableHeadCellClass}>{children}</th>;
  }
  return (
    <th className={tableHeadCellClass}>
      <button type="button" onClick={onClick} className="hover:text-ink">
        {children}
        {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}
