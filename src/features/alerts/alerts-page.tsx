"use client";

import { BellButton } from "@/components/layout/alert-center";
import { CountBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { dismissOrganizationAlert } from "@/lib/alerts/actions";
import { cn } from "@/lib/cn";
import type { WorkspaceAlertItem } from "@/lib/data/alerts";
import { ClientHeaderDate } from "@/components/ui/client-header-date";
import { formatRelative } from "@/lib/format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const STATUS_FILTERS = ["open", "resolved", "dismissed", "all"] as const;
const SEVERITY_FILTERS = ["All", "critical", "warning", "info"] as const;

export function AlertsPage({
  alerts,
  canWrite,
  kind,
}: {
  alerts: WorkspaceAlertItem[];
  canWrite: boolean;
  kind: "ok" | "no_organization" | "error";
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("open");
  const [severityFilter, setSeverityFilter] = useState<(typeof SEVERITY_FILTERS)[number]>("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const now = useMemo(() => new Date(), []);

  if (kind === "no_organization") {
    return (
      <>
        <PageHeader title="Alerts" subtitle="Workspace notifications that need attention." />
        <div className="px-4 py-8">
          <EmptyState title="No workspace yet" description="Join a workspace to see alerts." />
        </div>
      </>
    );
  }

  if (kind === "error") {
    return (
      <>
        <PageHeader title="Alerts" subtitle="Workspace notifications that need attention." />
        <div className="px-4 py-8">
          <EmptyState title="Could not load alerts" description="Try again in a moment." />
        </div>
      </>
    );
  }

  const projectOptions = [...new Set(alerts.map((item) => item.projectName).filter(Boolean))] as string[];
  const typeOptions = [...new Set(alerts.map((item) => item.alertType).filter(Boolean))] as string[];

  const visible = alerts.filter((alert) => {
    if (statusFilter !== "all" && alert.status !== statusFilter) return false;
    if (severityFilter !== "All" && alert.severity !== severityFilter) return false;
    if (projectFilter !== "All" && alert.projectName !== projectFilter) return false;
    if (typeFilter !== "All" && alert.alertType !== typeFilter) return false;
    return true;
  });

  function onDismiss(alertId: string) {
    setPendingId(alertId);
    startTransition(async () => {
      await dismissOrganizationAlert(alertId);
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader
        title="Alerts"
        subtitle="Open items that need review. The count is open alerts, not unread messages."
        actions={
          <>
            <BellButton />
            <ClientHeaderDate />
          </>
        }
      />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((status) => (
            <Button
              key={status}
              type="button"
              variant={statusFilter === status ? "primary" : "secondary"}
              onClick={() => setStatusFilter(status)}
            >
              {status}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <label className="flex items-center gap-2 text-muted">
            Severity
            <select
              className="rounded-md border border-line bg-surface px-2 py-1 text-ink"
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as (typeof SEVERITY_FILTERS)[number])}
            >
              {SEVERITY_FILTERS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-muted">
            Project
            <select
              className="rounded-md border border-line bg-surface px-2 py-1 text-ink"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              <option value="All">All</option>
              {projectOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-muted">
            Type
            <select
              className="rounded-md border border-line bg-surface px-2 py-1 text-ink"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="All">All</option>
              {typeOptions.map((name) => (
                <option key={name} value={name}>
                  {name.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <CountBadge>{visible.length}</CountBadge>
        </div>

        {visible.length === 0 ? (
          <EmptyState title="No alerts in this filter" description="Open alerts will appear here when Noxheim detects a condition that needs review." />
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {visible.map((alert) => (
              <li key={alert.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                      {alert.severity} · {alert.status}
                      {alert.alertType ? ` · ${alert.alertType.replaceAll("_", " ")}` : ""}
                    </p>
                    <p className="text-sm font-semibold text-ink">{alert.title}</p>
                    {alert.summary ? (
                      <p className="mt-1 text-sm text-ink/80">{alert.summary}</p>
                    ) : null}
                    <p className={cn("mt-1 text-xs text-muted")}>
                      {alert.projectName ? `${alert.projectName} · ` : ""}
                      {formatRelative(alert.createdAt, now)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={alert.href} className="text-sm font-medium text-teal hover:underline">
                      View
                    </Link>
                    {canWrite && alert.status === "open" ? (
                      <button
                        type="button"
                        className="text-sm text-muted hover:text-ink disabled:opacity-50"
                        disabled={isPending && pendingId === alert.id}
                        onClick={() => onDismiss(alert.id)}
                      >
                        Dismiss
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
