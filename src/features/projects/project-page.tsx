"use client";

import { BellButton } from "@/components/layout/app-shell";
import {
  ConfidenceBadge,
  OutlookBadge,
  SourceBadge,
  StageBadge,
  StatusBadge,
} from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Disclaimer, EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/cn";
import { OVERVIEW_PIPELINE_STAGES, type OverviewPipelineStage } from "@/lib/data/overview-types";
import type { ProjectDetailViewModel } from "@/lib/data/project-detail-types";
import {
  canCompleteChecklist,
  formatCapacity,
  formatDate,
  formatHeaderDate,
  formatRelative,
} from "@/lib/format";
import { markRequirementComplete } from "@/lib/requirements/actions";
import { useWorkspace } from "@/lib/workspace-state";
import type { Alert } from "@/types";
import { AlertTriangle, Check, CheckCircle2, Circle, Info } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import dynamic from "next/dynamic";

const MiniMap = dynamic(() => import("@/features/map/mini-map").then((mod) => mod.MiniMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center rounded-md border border-line bg-canvas text-sm text-muted">
      Loading map…
    </div>
  ),
});

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "grid", label: "Grid Intelligence" },
  { id: "connection", label: "Connection Process" },
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Activity" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const SEVERITY_STYLES: Record<
  Alert["severity"],
  { wrap: string; icon: string; Icon: typeof AlertTriangle }
> = {
  critical: {
    wrap: "border-l-critical bg-critical-bg/60",
    icon: "text-critical",
    Icon: AlertTriangle,
  },
  warning: {
    wrap: "border-l-warning bg-warning-bg/70",
    icon: "text-warning",
    Icon: AlertTriangle,
  },
  info: {
    wrap: "border-l-info bg-info-bg/70",
    icon: "text-info",
    Icon: Info,
  },
  positive: {
    wrap: "border-l-success bg-success-bg/70",
    icon: "text-success",
    Icon: CheckCircle2,
  },
};

export function ProjectPage({
  project,
  error,
}: {
  project: ProjectDetailViewModel | null;
  error: string | null;
}) {
  const { addToCompare, compareIds } = useWorkspace();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = (searchParams.get("tab") as TabId | null) ?? "overview";

  if (error) {
    return (
      <>
        <PageHeader title="Project" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="Could not load project"
            description="Try again from the portfolio. If the problem continues, sign in again."
            action={
              <Link href="/portfolio">
                <Button>Open Portfolio</Button>
              </Link>
            }
          />
        </div>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <PageHeader title="Project not found" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="This project is not available"
            description="Return to the portfolio table and select a listed site."
            action={
              <Link href="/portfolio">
                <Button>Open Portfolio</Button>
              </Link>
            }
          />
        </div>
      </>
    );
  }

  return (
    <LoadedProjectPage
      project={project}
      tab={tab}
      compareIds={compareIds}
      onAddToCompare={addToCompare}
      onTabChange={(next) => router.replace(`/projects/${project.slug}?tab=${next}`)}
    />
  );
}

function LoadedProjectPage({
  project,
  tab,
  compareIds,
  onAddToCompare,
  onTabChange,
}: {
  project: ProjectDetailViewModel;
  tab: TabId;
  compareIds: string[];
  onAddToCompare: (id: string) => boolean;
  onTabChange: (tab: TabId) => void;
}) {
  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={`${project.technology} · ${formatCapacity(project)} · ${project.location}`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => onAddToCompare(project.slug)}
              disabled={compareIds.includes(project.slug)}
            >
              {compareIds.includes(project.slug) ? "In compare" : "Add to compare"}
            </Button>
            <BellButton />
            <span className="hidden text-sm text-muted sm:inline">{formatHeaderDate(project.lastUpdated)}</span>
          </>
        }
      />

      <div className="border-b border-line bg-canvas px-4 pb-4 sm:px-6 lg:px-8">
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4 xl:grid-cols-8">
          <Meta label="Grid operator" value={project.gridOperator || "—"} />
          <Meta label="Connection outlook" value={<OutlookBadge outlook={project.outlook} />} />
          <Meta label="Confidence" value={<ConfidenceBadge confidence={project.confidence} />} />
          <Meta label="Current stage" value={<StageBadge stage={project.stage} />} />
          <Meta label="Target COD" value={project.targetCOD || "—"} />
          <Meta label="Last updated" value={formatDate(project.lastUpdated)} />
          <Meta label="Voltage" value={project.voltageLevel || "—"} />
          <Meta label="Case ID" value={project.connectionCase?.caseId ?? "Not opened"} mono />
        </dl>
      </div>

      <div className="overflow-x-auto px-4 pt-3 sm:px-6 lg:px-8">
        <div className="flex min-w-max gap-1 border-b border-line">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm",
                tab === item.id
                  ? "border-teal font-medium text-ink"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        {tab === "overview" ? <OverviewTab project={project} /> : null}
        {tab === "grid" ? <GridTab project={project} /> : null}
        {tab === "connection" ? <ConnectionTab project={project} /> : null}
        {tab === "documents" ? <DocumentsTab project={project} /> : null}
        {tab === "activity" ? <ActivityTab project={project} /> : null}
      </div>
    </>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className={cn("mt-1", mono && "font-mono text-[13px]")}>{value}</dd>
    </div>
  );
}

function OverviewTab({ project }: { project: ProjectDetailViewModel }) {
  const { pushToast } = useToast();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onComplete(itemId: string) {
    setPendingId(itemId);
    startTransition(async () => {
      const result = await markRequirementComplete(itemId, project.slug);
      if (!result.ok) {
        pushToast({
          title: "Could not update requirement",
          description: "The change was not saved.",
          tone: "warning",
        });
        return;
      }
      router.refresh();
      pushToast({
        title: "Application readiness updated",
        description: "Requirement marked complete.",
        tone: "success",
      });
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-md border border-line bg-surface p-5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold">Application readiness</h2>
            <p className="mt-1 text-sm text-muted">Customer-side completeness for the current process.</p>
          </div>
          <p className="font-mono text-3xl font-semibold text-ink">
            {project.readinessPercent}%
            <span className="ml-1 text-sm font-sans font-medium text-muted">Ready</span>
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas">
          <div className="h-full bg-teal" style={{ width: `${project.readinessPercent}%` }} />
        </div>
        {project.requirements.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No requirements recorded for this project yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {project.requirements.map((item) => {
              const complete = item.status === "Complete";
              const interactive =
                project.canUpdateRequirements && canCompleteChecklist(item.status);
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {complete ? (
                        <Check size={14} className="shrink-0 text-success" />
                      ) : (
                        <Circle size={14} className="shrink-0 text-muted" />
                      )}
                      <span className="text-sm">{item.label}</span>
                    </div>
                    {item.category || item.dueDate ? (
                      <p className="mt-1 pl-6 text-xs text-muted">
                        {[item.category, item.dueDate ? `Due ${formatDate(item.dueDate)}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    {interactive ? (
                      <Button
                        variant="ghost"
                        onClick={() => onComplete(item.id)}
                        disabled={isPending && pendingId === item.id}
                      >
                        Mark complete
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="space-y-4">
        {project.alerts.length > 0 ? (
          <section className="overflow-hidden rounded-md border border-line bg-surface">
            <div className="border-b border-line px-5 py-3">
              <h2 className="text-base font-semibold">Project attention</h2>
              <p className="text-sm text-muted">Open alerts linked to this project.</p>
            </div>
            <ul>
              {project.alerts.map((alert) => {
                const style = SEVERITY_STYLES[alert.severity];
                const Icon = style.Icon;
                return (
                  <li
                    key={alert.id}
                    className={cn(
                      "flex items-start gap-3 border-b border-line border-l-4 px-5 py-3.5 last:border-b-0",
                      style.wrap,
                    )}
                  >
                    <Icon size={16} className={cn("mt-0.5 shrink-0", style.icon)} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{alert.title}</p>
                      {alert.summary ? (
                        <p className="mt-0.5 text-sm text-ink/80">{alert.summary}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Project</h2>
          {project.description ? (
            <p className="mt-2 text-sm leading-6 text-ink/90">{project.description}</p>
          ) : (
            <p className="mt-2 text-sm text-muted">No project description recorded.</p>
          )}
          <Disclaimer className="mt-4" />
        </section>
        <section className="overflow-hidden rounded-md border border-line bg-surface">
          <div className="border-b border-line px-5 py-3">
            <h2 className="text-base font-semibold">Location</h2>
            <p className="text-sm text-muted">
              {[project.location, project.region].filter(Boolean).join(", ") || "Location not set"}
            </p>
          </div>
          {project.hasCoordinates ? (
            <MiniMap latitude={project.latitude} longitude={project.longitude} outlook={project.outlook} />
          ) : (
            <p className="px-5 py-8 text-sm text-muted">No site coordinates recorded for this project.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function GridTab({ project }: { project: ProjectDetailViewModel }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-md border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Grid intelligence</h2>
        </div>
        <p className="mt-2 text-sm text-muted">Live grid intelligence not connected yet.</p>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm">
          <Row label="Grid operator" value={project.gridOperator || "—"} />
          <Row label="Location" value={project.location || "—"} />
          <Row label="Technology" value={project.technology} />
          <Row label="MW" value={formatCapacity(project)} />
          <Row label="Outlook" value={<OutlookBadge outlook={project.outlook} />} />
          <Row label="Confidence" value={<ConfidenceBadge confidence={project.confidence} />} />
        </dl>
        <Disclaimer className="mt-4" />
      </section>
      <div className="space-y-4">
        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Known constraints</h2>
          <p className="mt-2 text-sm text-muted">Live grid intelligence not connected yet.</p>
        </section>
        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Planned reinforcement</h2>
          <p className="mt-2 text-sm text-muted">Live grid intelligence not connected yet.</p>
        </section>
        <section className="rounded-md border border-line bg-canvas p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            How to read this
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <SourceBadge source="Official" />
            <SourceBadge source="Indicative" />
            <SourceBadge source="Customer Data" />
            <SourceBadge source="NOXHEIM Analysis" />
          </div>
          <p className="mt-3 text-sm text-muted">
            Official documents and operator correspondence are primary. Public maps and capacity
            signals are indicative. Customer files are labelled separately. NOXHEIM analysis is a
            working judgement, not a capacity guarantee.
          </p>
        </section>
      </div>
    </div>
  );
}

function ConnectionTab({ project }: { project: ProjectDetailViewModel }) {
  const current = project.stage;
  const params = useSearchParams();
  const selected = (params.get("stage") as OverviewPipelineStage | null) ?? current;
  const router = useRouter();
  const currentIndex = OVERVIEW_PIPELINE_STAGES.indexOf(current);
  const connectionCase = project.connectionCase;
  const submitted = project.requirements
    .filter((item) => item.status === "Complete")
    .map((item) => item.label);
  const missing = project.requirements
    .filter((item) => item.status === "Missing")
    .map((item) => item.label);
  const requirementLabels = project.requirements.map((item) => item.label);

  function selectStage(stage: OverviewPipelineStage) {
    router.replace(
      `/projects/${project.slug}?tab=connection&stage=${encodeURIComponent(stage)}`,
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Connection process</h2>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {OVERVIEW_PIPELINE_STAGES.map((stage, index) => {
            const state =
              index < currentIndex ? "complete" : index === currentIndex ? "current" : "future";
            return (
              <button
                key={stage}
                type="button"
                onClick={() => selectStage(stage)}
                className={cn(
                  "min-w-[120px] flex-1 rounded-md border px-3 py-2 text-left text-sm",
                  selected === stage && "ring-1 ring-teal",
                  state === "complete" && "border-success bg-success-bg text-success",
                  state === "current" && "border-teal bg-teal-soft text-teal",
                  state === "future" && "border-line bg-canvas text-muted",
                )}
              >
                <p className="text-[10px] uppercase tracking-wide opacity-80">
                  {state === "complete" ? "Complete" : state === "current" ? "Current" : "Future"}
                </p>
                <p className="mt-1 font-medium">{stage}</p>
              </button>
            );
          })}
        </div>
      </section>

      {connectionCase ? (
        <section className="rounded-md border border-line bg-surface p-5">
          <h3 className="text-base font-semibold">{current}</h3>
          <dl className="mt-3 grid gap-3 text-sm md:grid-cols-3">
            <Row label="Case reference" value={connectionCase.caseId ?? "—"} />
            <Row label="Status" value={<StatusBadge status={connectionCase.status} />} />
            {connectionCase.submittedAt ? (
              <Row label="Submitted" value={formatDate(connectionCase.submittedAt)} />
            ) : null}
            {connectionCase.nextMilestone ? (
              <Row label="Next milestone" value={connectionCase.nextMilestone} />
            ) : null}
            {connectionCase.deadline ? (
              <Row label="Deadline" value={formatDate(connectionCase.deadline)} />
            ) : null}
            {connectionCase.ownerName ? (
              <Row label="Responsible owner" value={connectionCase.ownerName} />
            ) : null}
            <Row label="Project stage" value={project.stage} />
          </dl>
          {connectionCase.notes ? (
            <p className="mt-3 text-sm leading-6 text-muted">{connectionCase.notes}</p>
          ) : null}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <ListBlock title="Requirements" items={requirementLabels} />
            <ListBlock title="Submitted" items={submitted} />
            <ListBlock title="Missing" items={missing} empty="None outstanding" />
          </div>
        </section>
      ) : (
        <EmptyState
          title="No connection case yet"
          description="A connection case has not been opened for this project."
        />
      )}
    </div>
  );
}

function DocumentsTab({ project }: { project: ProjectDetailViewModel }) {
  if (project.documents.length === 0) {
    return (
      <EmptyState
        title="No documents on this project yet"
        description="Document files are not stored yet. Metadata will appear here when records exist."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Document</th>
            <th className="px-4 py-2 font-medium">Category</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Created</th>
            <th className="px-4 py-2 font-medium">Updated</th>
            <th className="px-4 py-2 font-medium">Owner</th>
          </tr>
        </thead>
        <tbody>
          {project.documents.map((doc) => (
            <tr key={doc.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3 font-medium">{doc.name}</td>
              <td className="px-4 py-3">{doc.category}</td>
              <td className="px-4 py-3">
                <StatusBadge status={doc.status} />
              </td>
              <td className="px-4 py-3 text-muted">{formatDate(doc.createdAt)}</td>
              <td className="px-4 py-3 text-muted">{formatDate(doc.updatedAt)}</td>
              <td className="px-4 py-3">{doc.owner ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityTab({ project }: { project: ProjectDetailViewModel }) {
  const now = useMemo(() => new Date(), []);

  if (project.events.length === 0) {
    return (
      <EmptyState
        title="No activity recorded"
        description="Project events will appear here as the connection process moves."
      />
    );
  }

  return (
    <ol className="space-y-3">
      {project.events.map((event) => (
        <li key={event.id} className="rounded-md border border-line bg-surface px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{event.title}</p>
            <div className="flex items-center gap-2">
              {event.source ? (
                <SourceBadge source={event.source} />
              ) : event.eventType ? (
                <span className="text-xs text-muted">{event.eventType}</span>
              ) : null}
              <span className="text-xs text-muted">{formatRelative(event.occurredAt, now)}</span>
            </div>
          </div>
          {event.detail ? (
            <p className="mt-1 text-sm leading-6 text-muted">{event.detail}</p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2 last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="max-w-[70%] text-right">{value}</dd>
    </div>
  );
}

function ListBlock({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty?: string;
}) {
  return (
    <div className="rounded-md border border-line bg-canvas p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{empty ?? "None listed"}</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
