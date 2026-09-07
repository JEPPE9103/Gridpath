"use client";

import { BellButton } from "@/components/layout/app-shell";
import { StageBadge } from "@/components/ui/badges";
import { Button, buttonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { OfficialChangesSignal } from "@/features/changes/official-changes-signal";
import { DocumentUploadForm } from "@/features/documents/document-upload-form";
import { ConnectionCasePanel } from "@/features/projects/connection-case-panel";
import { RequirementsManager } from "@/features/projects/requirements-manager";
import { cn } from "@/lib/cn";
import type { GridOperatorOption } from "@/lib/data/grid-operators";
import type { ProjectDetailViewModel, ProjectDocumentItem } from "@/lib/data/project-detail-types";
import type { SourceHealthView } from "@/lib/data/source-health";
import {
  CONNECTION_READINESS_DISCLAIMER,
  CONNECTION_TRACKING_DISCLAIMER,
  classifyConnectionEvent,
  connectionCaseLifecycle,
  connectionEventKindLabel,
  connectionNextAction,
  connectionStageJourney,
  groupConnectionRequirements,
  latestActivityAt,
  recentProjectDocuments,
} from "@/lib/domain/connection-workspace";
import { deadlineRelativeLabel } from "@/lib/domain/connection-deadlines";
import { isOfficialSourceUpdateDelayed } from "@/lib/domain/official-change-summary";
import { getDocumentDownloadUrl } from "@/lib/documents/actions";
import { formatDate, formatImportExport, formatRelative } from "@/lib/format";
import { ClientHeaderDate } from "@/components/ui/client-header-date";
import { deleteConnectionCaseAction } from "@/lib/connection-cases/actions";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore, useTransition, type ReactNode } from "react";

export function ConnectionWorkspace({
  project,
  operators,
  sourceHealth,
  standalone = false,
}: {
  project: ProjectDetailViewModel;
  operators: GridOperatorOption[];
  sourceHealth: SourceHealthView[];
  standalone?: boolean;
}) {
  const params = useSearchParams();
  const editRequested = params.get("edit") === "1";
  const delayed = sourceHealth.some((item) => isOfficialSourceUpdateDelayed(item.health));

  if (!project.connectionCase) {
    return (
      <div className="space-y-4">
        {standalone ? <WorkspaceHeader project={project} /> : null}
        <ConnectionCasePanel project={project} operators={operators} initialMode="view" />
      </div>
    );
  }

  if (editRequested && project.canManageConnectionCase) {
    return (
      <div className="space-y-4">
        {standalone ? <WorkspaceHeader project={project} /> : null}
        <ConnectionCasePanel project={project} operators={operators} initialMode="edit" />
      </div>
    );
  }

  return (
    <LoadedConnectionWorkspace
      project={project}
      sourceDelayed={delayed}
      standalone={standalone}
    />
  );
}

function WorkspaceHeader({ project }: { project: ProjectDetailViewModel }) {
  return (
    <PageHeader
      title="Connection application"
      subtitle={`${project.name} · customer-entered workflow`}
      actions={
        <>
          <Link href={`/projects/${project.slug}`} className={buttonClassName("secondary")}>
            View project
          </Link>
          <BellButton />
          <ClientHeaderDate />
        </>
      }
    />
  );
}

function LoadedConnectionWorkspace({
  project,
  sourceDelayed,
  standalone,
}: {
  project: ProjectDetailViewModel;
  sourceDelayed: boolean;
  standalone: boolean;
}) {
  const nowMs = useSyncExternalStore(
    () => () => {},
    () => Date.now(),
    () => Date.parse("2026-09-07T12:00:00Z"),
  );
  const connectionCase = project.connectionCase;
  if (!connectionCase) return null;
  const now = new Date(nowMs);
  const groups = groupConnectionRequirements(project.requirements, now);
  const nextAction = connectionNextAction({
    requirements: project.requirements,
    caseDeadline: connectionCase.deadline,
    caseStatusValue: connectionCase.statusValue,
    now,
  });
  const journey = connectionStageJourney(connectionCase.stage);
  const lifecycle = connectionCaseLifecycle(connectionCase.statusValue);
  const nextDeadline =
    groups.needsAttention[0]?.dueDate ??
    groups.upcoming.find((item) => item.dueDate)?.dueDate ??
    connectionCase.deadline;
  const lastActivity = latestActivityAt(project.events, project.lastUpdated);
  const documents = recentProjectDocuments(project.documents);
  const localNetwork = project.officialGridAreaContext?.areas[0] ?? null;
  const nup = project.officialNetworkDevelopmentPlanContext?.planningAreas[0] ?? null;
  const readinessLabel =
    project.readinessPercent == null
      ? "Not available"
      : `${project.readinessPercent}%`;

  return (
    <div className="space-y-4">
      {standalone ? <WorkspaceHeader project={project} /> : null}

      <section className="rounded-md border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Connection application
            </p>
            <h2 className="mt-1 text-xl font-semibold">{project.name}</h2>
            <p className="mt-1 text-sm text-muted">
              {connectionCase.gridOperatorName || project.gridOperator || "Operator not set"}
              {connectionCase.caseId ? ` · ${connectionCase.caseId}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {project.canManageConnectionCase ? (
              <Link
                href={`/projects/${project.slug}/connection?edit=1`}
                className={buttonClassName("secondary")}
              >
                Edit connection
              </Link>
            ) : null}
            {project.canUpdateRequirements ? (
              <a href="#connection-requirements" className={buttonClassName("secondary")}>
                Add requirement
              </a>
            ) : null}
            {project.canEdit ? (
              <a href="#connection-documents" className={buttonClassName("secondary")}>
                Upload document
              </a>
            ) : null}
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 xl:grid-cols-6">
          <Meta label="Stage" value={<StageBadge stage={connectionCase.stage} />} />
          <Meta label="Requested" value={formatImportExport(project)} />
          <Meta
            label="Target / milestone"
            value={connectionCase.nextMilestone || project.targetCOD || "—"}
          />
          <Meta
            label="Readiness"
            value={
              project.readinessPercent == null
                ? "Not available"
                : `${readinessLabel} workflow ready`
            }
          />
          <Meta
            label="Outstanding"
            value={
              groups.requiredCount === 0
                ? "No required items"
                : `${groups.outstandingRequiredCount} required`
            }
          />
          <Meta
            label="Next deadline"
            value={
              nextDeadline
                ? `${formatDate(nextDeadline)}${deadlineRelativeLabel(nextDeadline, now) ? ` · ${deadlineRelativeLabel(nextDeadline, now)}` : ""}`
                : "—"
            }
          />
        </dl>
        <p className="mt-3 text-xs text-muted">
          {groups.overdueRequiredCount > 0
            ? `${groups.overdueRequiredCount} overdue required item${groups.overdueRequiredCount === 1 ? "" : "s"}`
            : "No overdue required items"}
          {lastActivity ? ` · Last activity ${formatDate(lastActivity)}` : ""}
          {lifecycle !== "active" ? ` · Case ${connectionCase.status}` : ""}
          {connectionCase.createdAt ? ` · Recorded ${formatDate(connectionCase.createdAt)}` : ""}
          {project.archivedAt ? " · Project archived" : ""}
        </p>
        {!project.canManageConnectionCase ? (
          <p className="mt-2 text-xs text-muted">Review is read-only for this role.</p>
        ) : null}
        {connectionCase.notes ? (
          <p className="mt-3 text-sm leading-6 text-muted">{connectionCase.notes}</p>
        ) : null}
        {project.canDeleteConnectionCase ? <DeleteCaseButton project={project} caseId={connectionCase.id} /> : null}
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Next action</h2>
        <p className="mt-2 text-sm font-medium">{nextAction.title}</p>
        <p className="mt-1 text-sm text-muted">{nextAction.detail}</p>
        <p className="mt-3 text-xs leading-5 text-muted">
          Deterministic workflow guidance from recorded requirements and deadlines. Not a connection
          recommendation.
        </p>
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Stage</h2>
        <p className="mt-1 text-sm text-muted">
          Current: {journey.current}
          {journey.next ? ` · Next: ${journey.next}` : " · Final recorded stage"}
        </p>
        <ol className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {journey.stages.map((stage, index) => {
            const state =
              index < journey.currentIndex
                ? "past"
                : index === journey.currentIndex
                  ? "current"
                  : "later";
            return (
              <li
                key={stage}
                className={cn(
                  "min-w-[7.5rem] flex-1 rounded-md border px-3 py-2 text-left text-sm",
                  state === "past" && "border-success bg-success-bg text-success",
                  state === "current" && "border-teal bg-teal-soft text-teal",
                  state === "later" && "border-line bg-canvas text-muted",
                )}
              >
                <p className="text-[10px] uppercase tracking-wide opacity-80">
                  {state === "past" ? "Past" : state === "current" ? "Current" : "Later"}
                </p>
                <p className="mt-1 font-medium">{stage}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Connection readiness</h2>
        <p className="mt-2 font-mono text-3xl font-semibold">
          {project.readinessPercent == null ? (
            <span className="font-sans text-lg font-medium text-muted">Not available</span>
          ) : (
            <>
              {project.readinessPercent}%
              <span className="ml-2 font-sans text-sm font-medium text-muted">
                {groups.completeRequiredCount} / {groups.requiredCount} required items complete
              </span>
            </>
          )}
        </p>
        {groups.outstandingRequiredCount > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {groups.needsAttention.concat(groups.upcoming).map((item) => (
              <li key={item.id}>
                {item.label}
                {item.dueLabel ? ` · ${item.dueLabel}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No outstanding required items.</p>
        )}
        <p className="mt-3 text-xs leading-5 text-muted">{CONNECTION_READINESS_DISCLAIMER}</p>
      </section>

      <div id="connection-requirements">
        <RequirementsManager project={project} grouped />
      </div>

      <section id="connection-documents" className="rounded-md border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Documents</h2>
            <p className="mt-1 text-sm text-muted">
              Project files stored in this workspace. They are not linked to a specific requirement
              unless your team records that in the file name.
            </p>
          </div>
          <Link
            href={`/projects/${project.slug}?tab=documents`}
            className="text-sm font-medium text-teal hover:underline"
          >
            View all
          </Link>
        </div>
        <p className="mt-2 text-sm">{project.documents.length} files</p>
        {project.canEdit ? (
          <div className="mt-3">
            <DocumentUploadForm
              projects={[{ id: project.id, name: project.name }]}
              defaultProjectId={project.id}
              compact
            />
          </div>
        ) : null}
        {documents.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No project files uploaded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate">{doc.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                  {doc.uploadedAt ? formatDate(doc.uploadedAt) : formatDate(doc.updatedAt)}
                  <DocumentQuickOpen document={doc} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Official grid context</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <Meta
            label="Local network"
            value={
              localNetwork
                ? [localNetwork.officialOperatorName, localNetwork.concessionId]
                    .filter(Boolean)
                    .join(" — ") || localNetwork.name
                : "No local network area match"
            }
          />
          <Meta
            label="NUP"
            value={
              nup
                ? [nup.officialOperatorName, nup.name].filter(Boolean).join(", ")
                : "No NUP context match"
            }
          />
        </dl>
        <p className="mt-3 text-xs leading-5 text-muted">
          Covering official geography, not a connection point or available capacity.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/projects/${project.slug}?tab=grid`} className={buttonClassName("secondary")}>
            View Grid Intelligence
          </Link>
          <Link
            href={`/map?project=${encodeURIComponent(project.slug)}`}
            className={buttonClassName("secondary")}
          >
            View on Map
          </Link>
          <Link
            href={`/changes?project=${encodeURIComponent(project.id)}`}
            className={buttonClassName("secondary")}
          >
            Review official changes
          </Link>
        </div>
      </section>

      <OfficialChangesSignal
        counts={project.officialChanges}
        href={`/changes?project=${encodeURIComponent(project.id)}`}
        sourceDelayed={sourceDelayed}
      />

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">History</h2>
        <p className="mt-1 text-sm text-muted">Customer-entered workflow activity for this project.</p>
        {project.events.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No connection activity recorded yet.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {project.events.slice(0, 20).map((event) => {
              const kind = classifyConnectionEvent(event.title);
              return (
                <li key={event.id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{event.title}</p>
                    <span className="text-xs text-muted">
                      {connectionEventKindLabel(kind)} · {formatDate(event.occurredAt)} ·{" "}
                      {formatRelative(event.occurredAt, now)}
                    </span>
                  </div>
                  {event.detail ? (
                    <p className="mt-1 text-sm leading-6 text-muted">{event.detail}</p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <p className="text-xs leading-5 text-muted">{CONNECTION_TRACKING_DISCLAIMER}</p>
    </div>
  );
}

function DeleteCaseButton({
  project,
  caseId,
}: {
  project: ProjectDetailViewModel;
  caseId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-4">
      {error ? <p className="mb-2 text-sm text-critical">{error}</p> : null}
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              "Delete this connection case? Requirements stay on the project.",
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await deleteConnectionCaseAction(caseId, project.slug);
            if (!result.ok) {
              setError(result.error ?? "Could not delete the connection case.");
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Deleting…" : "Delete case"}
      </Button>
    </div>
  );
}

function DocumentQuickOpen({ document }: { document: ProjectDocumentItem }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!document.hasStoredFile) {
    return <span>Metadata only</span>;
  }
  return (
    <>
      <button
        type="button"
        className="font-medium text-teal hover:underline disabled:opacity-60"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await getDocumentDownloadUrl(document.id);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            window.open(result.url, "_blank", "noopener,noreferrer");
          });
        }}
      >
        {pending ? "Opening…" : "Open"}
      </button>
      {error ? <span className="text-critical">{error}</span> : null}
    </>
  );
}

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1">{value}</dd>
    </div>
  );
}
