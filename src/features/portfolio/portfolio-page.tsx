"use client";

import { BellButton } from "@/components/layout/app-shell";
import { ConfidenceBadge, OutlookBadge, StageBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatCapacity, formatDate, formatHeaderDate } from "@/lib/format";
import {
  OUTLOOKS,
  PIPELINE_STAGES,
  TECHNOLOGIES,
  type Outlook,
  type PipelineStage,
  type ProjectListItem,
  type Technology,
} from "@/types";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SortKey =
  | "name"
  | "location"
  | "technology"
  | "capacity"
  | "gridOperator"
  | "stage"
  | "outlook"
  | "targetCOD"
  | "lastUpdated";

export function PortfolioPage({
  projects,
  blockedByRls,
  error,
}: {
  projects: ProjectListItem[];
  blockedByRls: boolean;
  error: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [technology, setTechnology] = useState<Technology | "All">("All");
  const [operator, setOperator] = useState("All");
  const [stage, setStage] = useState<PipelineStage | "All">("All");
  const [outlook, setOutlook] = useState<Outlook | "All">("All");
  const [sortKey, setSortKey] = useState<SortKey>("lastUpdated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const operators = useMemo(
    () => ["All", ...new Set(projects.map((project) => project.gridOperator))].sort(),
    [projects],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = projects.filter((project) => {
      const matchesQuery =
        !q ||
        project.name.toLowerCase().includes(q) ||
        project.location.toLowerCase().includes(q) ||
        project.gridOperator.toLowerCase().includes(q);
      return (
        matchesQuery &&
        (technology === "All" || project.technology === technology) &&
        (operator === "All" || project.gridOperator === operator) &&
        (stage === "All" || project.stage === stage) &&
        (outlook === "All" || project.outlook === outlook)
      );
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => compareProjects(a, b, sortKey) * dir);
  }, [projects, query, technology, operator, stage, outlook, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" || key === "location" ? "asc" : "desc");
    }
  }

  return (
    <>
      <PageHeader
        title="Portfolio"
        subtitle={`${filtered.length} of ${projects.length} sites`}
        actions={
          <>
            <BellButton />
            <span className="hidden text-sm text-muted sm:inline">{formatHeaderDate("2026-08-18")}</span>
          </>
        }
      />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search project, location or operator"
            className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm sm:w-64"
          />
          <Select
            value={technology}
            onChange={(value) => setTechnology(value as Technology | "All")}
            options={["All", ...TECHNOLOGIES]}
            label="Technology"
          />
          <Select
            value={operator}
            onChange={setOperator}
            options={operators}
            label="Operator"
          />
          <Select
            value={stage}
            onChange={(value) => setStage(value as PipelineStage | "All")}
            options={["All", ...PIPELINE_STAGES]}
            label="Stage"
          />
          <Select
            value={outlook}
            onChange={(value) => setOutlook(value as Outlook | "All")}
            options={["All", ...OUTLOOKS]}
            label="Outlook"
          />
        </div>

        {blockedByRls ? (
          <EmptyState
            title="Projects require a signed-in workspace user"
            description="Row-level security is blocking anonymous reads of the seeded NorthGrid organization. Authentication is not enabled yet, so the Portfolio cannot load local Supabase data until a seed user and organization membership exist."
          />
        ) : error ? (
          <EmptyState
            title="Could not load projects"
            description={error}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No projects match these filters"
            description="Clear search or filters to see the full Sweden portfolio."
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-line bg-surface">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>
                    Project
                  </Th>
                  <Th onClick={() => toggleSort("location")} active={sortKey === "location"} dir={sortDir}>
                    Location
                  </Th>
                  <Th onClick={() => toggleSort("technology")} active={sortKey === "technology"} dir={sortDir}>
                    Technology
                  </Th>
                  <Th onClick={() => toggleSort("capacity")} active={sortKey === "capacity"} dir={sortDir}>
                    Capacity
                  </Th>
                  <Th onClick={() => toggleSort("gridOperator")} active={sortKey === "gridOperator"} dir={sortDir}>
                    Grid Operator
                  </Th>
                  <Th onClick={() => toggleSort("stage")} active={sortKey === "stage"} dir={sortDir}>
                    Stage
                  </Th>
                  <Th>Outlook</Th>
                  <Th>Confidence</Th>
                  <Th onClick={() => toggleSort("targetCOD")} active={sortKey === "targetCOD"} dir={sortDir}>
                    Target COD
                  </Th>
                  <Th onClick={() => toggleSort("lastUpdated")} active={sortKey === "lastUpdated"} dir={sortDir}>
                    Last Update
                  </Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => (
                  <tr
                    key={project.id}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-canvas"
                    onClick={() => router.push(`/projects/${project.id}`)}
                  >
                    <td className="px-4 py-3 font-medium">{project.name}</td>
                    <td className="px-4 py-3 text-muted">{project.location}</td>
                    <td className="px-4 py-3">{project.technology}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{formatCapacity(project)}</td>
                    <td className="px-4 py-3">{project.gridOperator}</td>
                    <td className="px-4 py-3">
                      <StageBadge stage={project.stage} />
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
      </div>
    </>
  );
}

function compareProjects(a: ProjectListItem, b: ProjectListItem, key: SortKey): number {
  if (key === "capacity") {
    return Math.max(a.importMW, a.exportMW) - Math.max(b.importMW, b.exportMW);
  }
  if (key === "lastUpdated") {
    return new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime();
  }

  const left = a[key];
  const right = b[key];
  return String(left).localeCompare(String(right), "sv");
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
      <span className="text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-ink"
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
