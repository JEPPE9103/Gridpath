"use client";

import { BellButton } from "@/components/layout/app-shell";
import { StageBadge, StatusBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, formatHeaderDate } from "@/lib/format";
import { connectionRepository, projectRepository } from "@/lib/repositories";
import { useWorkspace } from "@/lib/workspace-state";
import { CONNECTION_STAGES, type ConnectionStage } from "@/types";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export function ConnectionsPage() {
  const { overlays } = useWorkspace();
  const projects = useMemo(() => projectRepository.list(overlays), [overlays]);
  const cases = connectionRepository.list();
  const router = useRouter();
  const [operator, setOperator] = useState("All");
  const [stage, setStage] = useState<ConnectionStage | "All">("All");

  const operators = ["All", ...new Set(cases.map((item) => item.operator))].sort();

  const rows = cases.filter(
    (item) =>
      (operator === "All" || item.operator === operator) &&
      (stage === "All" || item.stage === stage),
  );

  return (
    <>
      <PageHeader
        title="Connections"
        subtitle={`${rows.length} active connection cases`}
        actions={
          <>
            <BellButton />
            <span className="text-sm text-muted">{formatHeaderDate("2026-08-18")}</span>
          </>
        }
      />
      <div className="space-y-4 px-8 py-6">
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
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No connection cases match"
            description="Prospect and screened sites do not have an opened operator case yet."
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
                {rows.map((item) => {
                  const project = projects.find((p) => p.id === item.projectId);
                  return (
                    <tr
                      key={item.id}
                      className="cursor-pointer border-b border-line last:border-0 hover:bg-canvas"
                      onClick={() =>
                        router.push(`/projects/${item.projectId}?tab=connection`)
                      }
                    >
                      <td className="px-4 py-3 font-medium">{project?.name ?? item.projectId}</td>
                      <td className="px-4 py-3">{item.operator}</td>
                      <td className="px-4 py-3 font-mono text-[13px]">{item.caseId}</td>
                      <td className="px-4 py-3">
                        <StageBadge stage={item.stage} />
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {item.submittedAt ? formatDate(item.submittedAt) : "—"}
                      </td>
                      <td className="px-4 py-3">{item.nextMilestone}</td>
                      <td className="px-4 py-3 text-muted">
                        {item.deadline ? formatDate(item.deadline) : "—"}
                      </td>
                      <td className="px-4 py-3">{item.owner}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
