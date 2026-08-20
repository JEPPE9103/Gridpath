"use client";

import { BellButton } from "@/components/layout/app-shell";
import { StageBadge, StatusBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import {
  CONNECTION_CASE_STATUS_FILTERS,
  isActiveConnectionCase,
  type ConnectionCaseListItem,
  type ConnectionCaseListStatus,
  type ConnectionCasesResult,
} from "@/lib/data/connections-types";
import { formatDate, formatHeaderDate } from "@/lib/format";
import { CONNECTION_STAGES, type ConnectionStage } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function ConnectionsPage({ result }: { result: ConnectionCasesResult }) {
  if (result.kind === "no_organization") {
    return (
      <>
        <PageHeader title="Connections" subtitle="Workspace connections" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="No workspace yet"
            description="This account is not a member of an organisation. Create or join a workspace to see connection cases."
          />
        </div>
      </>
    );
  }

  if (result.kind === "error") {
    return (
      <>
        <PageHeader title="Connections" subtitle="Workspace connections" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="Could not load connection cases"
            description="Try again in a moment. If the problem continues, sign in again."
          />
        </div>
      </>
    );
  }

  return <LoadedConnectionsPage cases={result.cases} />;
}

function LoadedConnectionsPage({ cases }: { cases: ConnectionCaseListItem[] }) {
  const router = useRouter();
  const [operator, setOperator] = useState("All");
  const [stage, setStage] = useState<ConnectionStage | "All">("All");
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
    waitingCount ? `${waitingCount} awaiting operator response` : null,
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
        subtitle={`${activeCases.length} active connection cases`}
        actions={
          <>
            <BellButton />
            <span className="hidden text-sm text-muted sm:inline">{formatHeaderDate()}</span>
          </>
        }
      />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <div className="flex flex-wrap gap-2">
          <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2 text-sm">
            <span className="text-muted">Operator</span>
            <select
              value={operator}
              onChange={(event) => setOperator(event.target.value)}
              className="bg-transparent"
            >
              {operators.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2 text-sm">
            <span className="text-muted">Stage</span>
            <select
              value={stage}
              onChange={(event) => setStage(event.target.value as ConnectionStage | "All")}
              className="bg-transparent"
            >
              <option>All</option>
              {CONNECTION_STAGES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2 text-sm">
            <span className="text-muted">Status</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as ConnectionCaseListStatus | "All")
              }
              className="bg-transparent"
            >
              <option>All</option>
              {CONNECTION_CASE_STATUS_FILTERS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        {summaryBits.length > 0 ? (
          <p className="text-sm text-muted">{summaryBits.join(" · ")}</p>
        ) : null}

        {cases.length === 0 ? (
          <EmptyState
            title="No connection cases yet"
            description="Opened grid connection processes for this workspace will appear here."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No connection cases match"
            description="Prospect and screened sites do not have an opened operator case yet. Clear filters to see all cases."
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-line bg-surface">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Project</th>
                  <th className="px-4 py-2 font-medium">Grid Operator</th>
                  <th className="px-4 py-2 font-medium">Case ID</th>
                  <th className="px-4 py-2 font-medium">Stage</th>
                  <th className="px-4 py-2 font-medium">Submitted</th>
                  <th className="px-4 py-2 font-medium">Next Milestone</th>
                  <th className="px-4 py-2 font-medium">Deadline</th>
                  <th className="px-4 py-2 font-medium">Owner</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-canvas"
                    onClick={() => router.push(`/projects/${item.projectSlug}?tab=connection`)}
                  >
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/projects/${item.projectSlug}`}
                        className="hover:text-teal"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {item.projectName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{item.gridOperator || "—"}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{item.caseId ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StageBadge stage={item.stage} />
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {item.submittedAt ? formatDate(item.submittedAt) : "—"}
                    </td>
                    <td className="px-4 py-3">{item.nextMilestone || "—"}</td>
                    <td
                      className={cn(
                        "px-4 py-3",
                        item.deadlineAttention === "overdue" && "text-critical",
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
                    <td className="px-4 py-3">{item.ownerName ?? "Unassigned"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
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
