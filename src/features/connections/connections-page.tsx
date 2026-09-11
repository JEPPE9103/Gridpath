"use client";

import { BellButton } from "@/components/layout/app-shell";
import { StageBadge, StatusBadge } from "@/components/ui/badges";
import { ClientHeaderDate } from "@/components/ui/client-header-date";
import { EmptyState, EmptyProjectsAction, EmptyWorkspaceAction, ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  FilterBar,
  FilterSelect,
  PageBody,
  quietActionClass,
  tableBodyRowClass,
  tableCellClass,
  tableHeadCellClass,
  tableHeadClass,
  tableWrapClass,
  textActionClass,
} from "@/components/ui/workspace";
import { cn } from "@/lib/cn";
import {
  CONNECTION_CASE_STATUS_FILTERS,
  isActiveConnectionCase,
  type ConnectionCaseListItem,
  type ConnectionCaseListStatus,
  type ConnectionCasesResult,
} from "@/lib/data/connections-types";
import { formatDate } from "@/lib/format";
import { OVERVIEW_PIPELINE_STAGES, type OverviewPipelineStage } from "@/lib/data/overview-types";
import Link from "next/link";
import { useMemo, useState } from "react";

export function ConnectionsPage({ result }: { result: ConnectionCasesResult }) {
  if (result.kind === "no_organization") {
    return (
      <>
        <PageHeader title="Connections" eyebrow="Develop" subtitle="Connection process tracking — not a DSO portal" />
        <PageBody>
          <EmptyState
            title="No workspace yet"
            description="This account is not a member of an organisation. Create or join a workspace to see connection cases."
            action={<EmptyWorkspaceAction />}
          />
        </PageBody>
      </>
    );
  }

  if (result.kind === "error") {
    return (
      <>
        <PageHeader title="Connections" eyebrow="Develop" subtitle="Connection process tracking — not a DSO portal" />
        <PageBody>
          <ErrorState
            title="Could not load connection cases"
            description="Try again in a moment. If the problem continues, sign in again."
          />
        </PageBody>
      </>
    );
  }

  return <LoadedConnectionsPage cases={result.cases} />;
}

function LoadedConnectionsPage({ cases }: { cases: ConnectionCaseListItem[] }) {
  const [operator, setOperator] = useState("All");
  const [stage, setStage] = useState<OverviewPipelineStage | "All">("All");
  const [status, setStatus] = useState<ConnectionCaseListStatus | "All">("All");

  const operators = useMemo(
    () => ["All", ...new Set(cases.map((item) => item.gridOperator).filter(Boolean))].sort(),
    [cases],
  );

  const activeCases = useMemo(
    () => cases.filter((item) => isActiveConnectionCase(item.status)),
    [cases],
  );

  const waitingCount = activeCases.filter((item) => item.status === "Waiting").length;
  const attentionCount = activeCases.filter(
    (item) => item.status === "At Risk" || item.status === "Overdue",
  ).length;
  const upcomingCount = activeCases.filter((item) => item.deadlineAttention === "approaching")
    .length;

  const summaryBits = [
    waitingCount ? `${waitingCount} waiting` : null,
    attentionCount ? `${attentionCount} at risk / overdue` : null,
    upcomingCount
      ? `${upcomingCount} upcoming deadline${upcomingCount === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);

  const rows = cases.filter(
    (item) =>
      (operator === "All" || item.gridOperator === operator) &&
      (stage === "All" || item.stage === stage) &&
      (status === "All" || item.status === status),
  );

  return (
    <>
      <PageHeader
        title="Connections"
        eyebrow="Develop"
        subtitle={`${activeCases.length} active cases · connection process tracking, not a DSO portal`}
        actions={
          <>
            <BellButton />
            <ClientHeaderDate />
          </>
        }
      />
      <PageBody className="space-y-4">
        <FilterBar>
          <FilterSelect
            label="Operator"
            value={operator}
            onChange={setOperator}
            options={operators}
          />
          <FilterSelect
            label="Stage"
            value={stage}
            onChange={(value) => setStage(value as OverviewPipelineStage | "All")}
            options={["All", ...OVERVIEW_PIPELINE_STAGES]}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(value) => setStatus(value as ConnectionCaseListStatus | "All")}
            options={["All", ...CONNECTION_CASE_STATUS_FILTERS]}
          />
        </FilterBar>

        {summaryBits.length > 0 ? (
          <p className="text-sm text-muted">{summaryBits.join(" · ")}</p>
        ) : null}

        {cases.length === 0 ? (
          <EmptyState
            title="No connection cases yet"
            description="Start a connection process from a project to track operator interaction here."
            action={<EmptyProjectsAction />}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No connection cases match"
            description="Clear filters to see all cases for this workspace."
          />
        ) : (
          <div className={tableWrapClass}>
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={tableHeadCellClass}>Project</th>
                  <th className={tableHeadCellClass}>Grid operator</th>
                  <th className={tableHeadCellClass}>Case ID</th>
                  <th className={tableHeadCellClass}>Stage</th>
                  <th className={tableHeadCellClass}>Submitted</th>
                  <th className={tableHeadCellClass}>Next milestone</th>
                  <th className={tableHeadCellClass}>Deadline</th>
                  <th className={tableHeadCellClass}>Owner</th>
                  <th className={tableHeadCellClass}>Status</th>
                  <th className={tableHeadCellClass}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} className={tableBodyRowClass}>
                    <td className={`${tableCellClass} font-medium`}>
                      <Link href={`/projects/${item.projectSlug}`} className="hover:text-teal">
                        {item.projectName}
                      </Link>
                    </td>
                    <td className={tableCellClass}>{item.gridOperator || "—"}</td>
                    <td className={`${tableCellClass} font-mono text-[13px]`}>{item.caseId ?? "—"}</td>
                    <td className={tableCellClass}>
                      <StageBadge stage={item.stage} />
                    </td>
                    <td className={`${tableCellClass} whitespace-nowrap text-muted`}>
                      {item.submittedAt ? formatDate(item.submittedAt) : "—"}
                    </td>
                    <td className={tableCellClass}>{item.nextMilestone || "—"}</td>
                    <td
                      className={cn(
                        tableCellClass,
                        "whitespace-nowrap",
                        item.deadlineAttention === "overdue" && "font-medium text-critical",
                        item.deadlineAttention === "approaching" && "text-warning",
                        (item.deadlineAttention === "normal" || !item.deadlineAttention) &&
                          "text-muted",
                      )}
                      title={
                        item.deadlineAttention === "overdue"
                          ? "Deadline has passed"
                          : item.deadlineAttention === "approaching"
                            ? "Deadline within 14 days"
                            : undefined
                      }
                    >
                      {item.deadline ? formatDate(item.deadline) : "—"}
                    </td>
                    <td className={tableCellClass}>{item.ownerName ?? "Unassigned"}</td>
                    <td className={tableCellClass}>
                      <StatusBadge status={item.status} />
                    </td>
                    <td className={`${tableCellClass} whitespace-nowrap text-right`}>
                      <Link
                        href={`/projects/${item.projectSlug}/connection`}
                        className={textActionClass}
                      >
                        Open workspace →
                      </Link>
                      <Link
                        href={`/projects/${item.projectSlug}/connection?edit=1`}
                        className={`ml-3 ${quietActionClass}`}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageBody>
    </>
  );
}
