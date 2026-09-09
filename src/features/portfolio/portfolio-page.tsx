"use client";

import { BellButton } from "@/components/layout/app-shell";
import { ConfidenceBadge, OutlookBadge, StageBadge } from "@/components/ui/badges";
import { Button, buttonClassName } from "@/components/ui/button";
import { EmptyState, EmptyProjectsAction } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ClientHeaderDate } from "@/components/ui/client-header-date";
import { formatCapacity, formatDate, formatMWTotal, formatOutlookLabel } from "@/lib/format";
import type { ListProjectsResult, PortfolioSortKey } from "@/lib/data/projects";
import { PORTFOLIO_PAGE_SIZE } from "@/lib/data/paged-select";
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
    const active = `${activeCount} active · ${formatMWTotal(activeMw)}`;
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
        title="Portfolio"
        subtitle={subtitle}
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
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <div className="flex flex-wrap gap-2">
          {(["active", "archived", "all"] as ArchiveView[]).map((view) => (
            <Link
              key={view}
              href={href({ view, page: "1" })}
              className={
                result.view === view
                  ? buttonClassName()
                  : buttonClassName("secondary")
              }
            >
              {view === "active" ? "Active" : view === "archived" ? "Archived" : "All"}
            </Link>
          ))}
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: query, page: "1" });
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search project or location"
            className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm sm:w-64"
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
          <Select
            value={result.technology}
            onChange={(value) => update({ technology: value === "All" ? "" : value, page: "1" })}
            options={["All", ...TECHNOLOGIES]}
            label="Technology"
          />
          <Select
            value={result.operator}
            onChange={(value) => update({ operator: value === "All" ? "" : value, page: "1" })}
            options={["All", ...result.operators]}
            label="Operator"
          />
          <Select
            value={result.stage}
            onChange={(value) => update({ stage: value === "All" ? "" : value, page: "1" })}
            options={["All", ...PIPELINE_STAGES]}
            label="Stage"
          />
          <Select
            value={result.outlook}
            onChange={(value) => update({ outlook: value === "All" ? "" : value, page: "1" })}
            options={["All", ...OUTLOOKS]}
            labels={{
              All: "All",
              ...Object.fromEntries(OUTLOOKS.map((outlook) => [outlook, formatOutlookLabel(outlook)])),
            }}
            label="Team outlook"
          />
          <Select
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
          <Select
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
        </form>
        <p className="text-sm text-muted">
          {result.matchingCount === 0
            ? "No matching projects"
            : `Showing ${from}–${to} of ${result.matchingCount} matching · page ${result.page} of ${pageCount} · ${PORTFOLIO_PAGE_SIZE} per page`}
        </p>

        {blockedByRls ? (
          <EmptyState
            title="Could not load projects"
            description="Sign in to a workspace to view the organization portfolio."
          />
        ) : error ? (
          <EmptyState title="Could not load projects" description={error} />
        ) : result.matchingCount === 0 && !result.query && result.technology === "All" && result.operator === "All" && result.stage === "All" && result.outlook === "All" && result.attentionFilter === "all" ? (
          <EmptyState
            title={result.view === "archived" ? "No archived projects" : "No projects yet"}
            description={
              result.view === "archived"
                ? "Archived projects will appear here. Active projects remain in the Active view."
                : "Add your first development project to start building your portfolio."
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
          <div className="overflow-x-auto rounded-md border border-line bg-surface">
            <table className="w-full min-w-[1280px] text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
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
                    Capacity
                  </Th>
                  <Th onClick={() => toggleSort("gridOperator")} active={result.sortKey === "gridOperator"} dir={result.sortDir}>
                    Grid Operator
                  </Th>
                  <Th onClick={() => toggleSort("stage")} active={result.sortKey === "stage"} dir={result.sortDir}>
                    Stage
                  </Th>
                  <Th>Next action</Th>
                  <Th>Team outlook</Th>
                  <Th>Team confidence</Th>
                  <Th onClick={() => toggleSort("targetCOD")} active={result.sortKey === "targetCOD"} dir={result.sortDir}>
                    Target COD
                  </Th>
                  <Th onClick={() => toggleSort("lastUpdated")} active={result.sortKey === "lastUpdated"} dir={result.sortDir}>
                    Last Update
                  </Th>
                </tr>
              </thead>
              <tbody>
                {result.projects.map((project) => (
                  <tr
                    key={project.projectId}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-canvas"
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <td className="px-4 py-3 font-medium">
                      <span className="inline-flex items-center gap-2">
                        <AttentionDot band={project.attentionBand} />
                        {project.name}
                      </span>
                      {project.archivedAt ? (
                        <span className="ml-2 text-xs font-normal text-muted">Archived</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted">{project.location}</td>
                    <td className="px-4 py-3">{project.technology}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{formatCapacity(project)}</td>
                    <td className="px-4 py-3">{project.gridOperator}</td>
                    <td className="px-4 py-3">
                      <StageBadge stage={project.stage} />
                      {project.daysInCurrentStage != null ? (
                        <p className="mt-1 text-xs text-muted">{project.daysInCurrentStage} days in stage</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {project.nextActionTitle ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <OutlookBadge outlook={project.outlook} />
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceBadge confidence={project.confidence} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[13px]">{project.targetCOD}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(project.lastUpdated)}</td>
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
            <Link
              href={href({ page: String(Math.min(pageCount, result.page + 1)) })}
              className={buttonClassName("secondary")}
              aria-disabled={result.page >= pageCount}
            >
              Next
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );
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
      <span className="text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-ink"
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

function AttentionDot({ band }: { band?: "action" | "attention" | "review" | "clear" }) {
  const tone =
    band === "action" ? "bg-critical" : band === "attention" ? "bg-warning" : band === "review" ? "bg-info" : "bg-line";
  const label =
    band === "action"
      ? "Action required"
      : band === "attention"
        ? "Watch"
        : band === "review"
          ? "Review"
          : "No immediate action";
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${tone}`} title={label} aria-label={label} />;
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
    return <th className="px-4 py-2 font-medium">{children}</th>;
  }
  return (
    <th className="px-4 py-2 font-medium">
      <button type="button" onClick={onClick} className="hover:text-ink">
        {children}
        {active ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );
}
