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
import { cn } from "@/lib/cn";
import {
  canCompleteChecklist,
  formatCapacity,
  formatDate,
  formatHeaderDate,
  formatRelative,
} from "@/lib/format";
import { projectRepository } from "@/lib/repositories";
import { useWorkspace } from "@/lib/workspace-state";
import { CONNECTION_STAGES, type ConnectionStage, type Project } from "@/types";
import { Check, Circle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, type ReactNode } from "react";
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

export function ProjectPage({ projectId }: { projectId: string }) {
  const { overlays, setChecklistStatus, addToCompare, compareIds } = useWorkspace();
  const project = useMemo(
    () => projectRepository.getById(projectId, overlays),
    [projectId, overlays],
  );
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = (searchParams.get("tab") as TabId | null) ?? "overview";

  if (!project) {
    return (
      <>
        <PageHeader title="Project not found" />
        <div className="px-8 py-8">
          <EmptyState
            title="This project is not in the demo portfolio"
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

  function setTab(next: TabId) {
    router.replace(`/projects/${projectId}?tab=${next}`);
  }

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={`${project.technology} · ${formatCapacity(project)} · ${project.location}`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => addToCompare(project.id)}
              disabled={compareIds.includes(project.id)}
            >
              {compareIds.includes(project.id) ? "In compare" : "Add to compare"}
            </Button>
            <BellButton />
            <span className="text-sm text-muted">{formatHeaderDate("2026-08-18")}</span>
          </>
        }
      />

      <div className="border-b border-line bg-canvas px-8 pb-4">
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4 xl:grid-cols-8">
          <Meta label="Grid operator" value={project.gridOperator} />
          <Meta label="Connection outlook" value={<OutlookBadge outlook={project.outlook} />} />
          <Meta label="Confidence" value={<ConfidenceBadge confidence={project.confidence} />} />
          <Meta label="Current stage" value={<StageBadge stage={project.stage} />} />
          <Meta label="Target COD" value={project.targetCOD} />
          <Meta label="Last updated" value={formatDate(project.lastUpdated)} />
          <Meta label="Voltage" value={project.voltageLevel} />
          <Meta label="Case ID" value={project.caseId ?? "Not opened"} mono />
        </dl>
      </div>

      <div className="px-8 pt-3">
        <div className="flex gap-1 border-b border-line">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
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

      <div className="px-8 py-6">
        {tab === "overview" ? (
          <OverviewTab project={project} onComplete={(itemId) => setChecklistStatus(project.id, itemId, "Complete")} />
        ) : null}
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

function OverviewTab({
  project,
  onComplete,
}: {
  project: Project;
  onComplete: (itemId: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-md border border-line bg-surface p-5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold">Application readiness</h2>
            <p className="mt-1 text-sm text-muted">Customer-side completeness for the current process.</p>
          </div>
          <p className="font-mono text-3xl font-semibold text-ink">
            {project.applicationReadiness.percent}%
            <span className="ml-1 text-sm font-sans font-medium text-muted">Ready</span>
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas">
          <div
            className="h-full bg-teal"
            style={{ width: `${project.applicationReadiness.percent}%` }}
          />
        </div>
        <ul className="mt-4 divide-y divide-line">
          {project.applicationReadiness.items.map((item) => {
            const complete = item.status === "Complete";
            const interactive = canCompleteChecklist(item.status);
            return (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-2">
                  {complete ? (
                    <Check size={14} className="text-success" />
                  ) : (
                    <Circle size={14} className="text-muted" />
                  )}
                  <span className="text-sm">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={item.status} />
                  {interactive ? (
                    <Button variant="ghost" onClick={() => onComplete(item.id)}>
                      Mark complete
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="space-y-4">
        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Project</h2>
          <p className="mt-2 text-sm leading-6 text-ink/90">{project.description}</p>
          <Disclaimer className="mt-4" />
        </section>
        <section className="overflow-hidden rounded-md border border-line bg-surface">
          <div className="border-b border-line px-5 py-3">
            <h2 className="text-base font-semibold">Location</h2>
            <p className="text-sm text-muted">
              {project.location}, {project.region}
            </p>
          </div>
          <MiniMap latitude={project.latitude} longitude={project.longitude} outlook={project.outlook} />
        </section>
      </div>
    </div>
  );
}

function GridTab({ project }: { project: Project }) {
  const grid = project.grid;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-md border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Grid intelligence</h2>
          <SourceBadge source={grid.source} />
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-3 text-sm">
          <Row label="Grid operator" value={grid.operator} />
          <Row label="Network area" value={grid.networkArea} />
          <Row label="Voltage level" value={grid.voltageLevel} />
          <Row label="Public capacity signal" value={grid.publicCapacitySignal} />
          <Row label="Source" value={grid.sourceName} />
          <Row label="Publication date" value={formatDate(grid.publicationDate)} />
          <Row label="Last retrieved" value={formatDate(grid.lastRetrieved)} />
          <Row label="Confidence" value={<ConfidenceBadge confidence={grid.confidence} />} />
        </dl>
        {grid.previousIndication || grid.currentIndication ? (
          <div className="mt-4 rounded-md border border-line bg-canvas p-3 text-sm">
            {grid.previousIndication ? (
              <p>
                <span className="text-muted">Previous indication: </span>
                {grid.previousIndication}
              </p>
            ) : null}
            {grid.currentIndication ? (
              <p className="mt-1">
                <span className="text-muted">Current indication: </span>
                {grid.currentIndication}
              </p>
            ) : null}
          </div>
        ) : null}
        <Disclaimer className="mt-4" />
      </section>
      <div className="space-y-4">
        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Known constraints</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
            {project.knownConstraints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Planned reinforcement</h2>
          <p className="mt-2 text-sm leading-6">{project.reinforcementInfo}</p>
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

function ConnectionTab({ project }: { project: Project }) {
  const current = project.connectionStage;
  const params = useSearchParams();
  const selected = (params.get("stage") as ConnectionStage | null) ?? current;
  const router = useRouter();
  const detail = project.stageDetails[selected] ?? project.stageDetails[current];
  const currentIndex = CONNECTION_STAGES.indexOf(current);

  function selectStage(stage: ConnectionStage) {
    router.replace(`/projects/${project.id}?tab=connection&stage=${encodeURIComponent(stage)}`);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Connection process</h2>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {CONNECTION_STAGES.map((stage, index) => {
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

      <section className="rounded-md border border-line bg-surface p-5">
        <h3 className="text-base font-semibold">{detail.stage}</h3>
        <dl className="mt-3 grid gap-3 text-sm md:grid-cols-3">
          <Row label="Responsible owner" value={detail.owner} />
          <Row label="Deadline" value={detail.deadline ? formatDate(detail.deadline) : "Not set"} />
          <Row label="Project stage" value={project.stage} />
        </dl>
        <p className="mt-3 text-sm leading-6 text-muted">{detail.notes}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <ListBlock title="Requirements" items={detail.requirements} />
          <ListBlock title="Submitted" items={detail.submitted} />
          <ListBlock title="Missing" items={detail.missing} empty="None outstanding" />
        </div>
      </section>
    </div>
  );
}

function DocumentsTab({ project }: { project: Project }) {
  if (project.documents.length === 0) {
    return (
      <EmptyState
        title="No documents on this project yet"
        description="Portfolio-wide documents can be added from the Documents workspace."
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
              <td className="px-4 py-3 text-muted">{formatDate(doc.updatedAt)}</td>
              <td className="px-4 py-3">{doc.owner}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityTab({ project }: { project: Project }) {
  const events = [...project.connectionHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="rounded-md border border-line bg-surface px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{event.title}</p>
            <div className="flex items-center gap-2">
              {event.source ? <SourceBadge source={event.source} /> : null}
              <span className="text-xs text-muted">{formatRelative(event.date)}</span>
            </div>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted">{event.detail}</p>
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
