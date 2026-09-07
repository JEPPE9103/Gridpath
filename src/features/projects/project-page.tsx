"use client";

import { BellButton } from "@/components/layout/app-shell";
import {
  ConfidenceBadge,
  OutlookBadge,
  SourceBadge,
  StageBadge,
} from "@/components/ui/badges";
import { Button, buttonClassName } from "@/components/ui/button";
import { Disclaimer, EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { OfficialChangesSignal } from "@/features/changes/official-changes-signal";
import { OfficialGeographicContextSection } from "@/features/projects/official-geographic-context";
import { OfficialNetworkDevelopmentPlanSection } from "@/features/projects/network-development-plan-section";
import { OfficialDataFreshnessStrip } from "@/features/projects/official-data-freshness";
import { DocumentTable } from "@/features/documents/document-table";
import { DocumentUploadForm } from "@/features/documents/document-upload-form";
import { DeleteProjectButton } from "@/features/projects/delete-project-button";
import { ArchiveProjectButton, RestoreProjectButton } from "@/features/projects/archive-project-button";
import { cn } from "@/lib/cn";
import { OVERVIEW_PIPELINE_STAGES } from "@/lib/data/overview-types";
import type { ProjectDetailViewModel } from "@/lib/data/project-detail-types";
import {
  confidenceLabel,
  gridAreaTypeLabel,
  gridAuthorityLabel,
  gridSourceTypeLabel,
} from "@/lib/domain/catalog-labels";
import { ClientAbsoluteDate, ClientHeaderDate } from "@/components/ui/client-header-date";
import { ConnectionCasePanel } from "@/features/projects/connection-case-panel";
import { DevelopmentBrief } from "@/features/projects/development-brief";
import { RequirementsManager } from "@/features/projects/requirements-manager";
import type { GridOperatorOption } from "@/lib/data/grid-operators";
import type { SourceHealthView } from "@/lib/data/source-health";
import { isOfficialSourceUpdateDelayed } from "@/lib/domain/official-change-summary";
import {
  formatDate,
  formatImportExport,
  formatRelative,
} from "@/lib/format";
import { useWorkspace } from "@/lib/workspace-state";
import type { Alert } from "@/types";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useSyncExternalStore, type ReactNode } from "react";

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
  operators = [],
  sourceHealth = [],
}: {
  project: ProjectDetailViewModel | null;
  error: string | null;
  operators?: GridOperatorOption[];
  sourceHealth?: SourceHealthView[];
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
      operators={operators}
      sourceHealth={sourceHealth}
      tab={tab}
      compareIds={compareIds}
      onAddToCompare={addToCompare}
      onTabChange={(next) => router.replace(`/projects/${project.slug}?tab=${next}`)}
    />
  );
}

function LoadedProjectPage({
  project,
  operators,
  sourceHealth,
  tab,
  compareIds,
  onAddToCompare,
  onTabChange,
}: {
  project: ProjectDetailViewModel;
  operators: GridOperatorOption[];
  sourceHealth: SourceHealthView[];
  tab: TabId;
  compareIds: string[];
  onAddToCompare: (id: string, name?: string) => boolean;
  onTabChange: (tab: TabId) => void;
}) {
  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={`${project.archivedAt ? "Archived · " : ""}${project.technology} · ${formatImportExport(project)} · ${project.location}`}
        actions={
          <>
            {project.canEdit ? (
              <Link
                href={`/projects/${project.slug}/edit`}
                className={buttonClassName("secondary")}
              >
                Edit project
              </Link>
            ) : null}
            {project.canArchive && !project.archivedAt ? (
              <ArchiveProjectButton projectId={project.id} projectName={project.name} />
            ) : null}
            {project.canArchive && project.archivedAt ? (
              <RestoreProjectButton projectId={project.id} />
            ) : null}
            <Button
              variant="secondary"
              onClick={() => onAddToCompare(project.slug, project.name)}
              disabled={Boolean(project.archivedAt) || compareIds.includes(project.slug)}
            >
              {project.archivedAt
                ? "Archived"
                : compareIds.includes(project.slug)
                  ? "In compare"
                  : "Add to compare"}
            </Button>
            <BellButton />
            <ClientHeaderDate iso={project.lastUpdated} />
          </>
        }
      />

      <div className="border-b border-line bg-canvas px-4 pb-4 sm:px-6 lg:px-8">
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4 xl:grid-cols-8">
          <Meta label="Project operator" value={project.gridOperator || "—"} />
          <Meta label="Connection stage" value={<StageBadge stage={project.stage} />} />
          <Meta label="Team outlook" value={<OutlookBadge outlook={project.outlook} />} />
          <Meta label="Team confidence" value={`${project.confidence} confidence`} />
          <Meta label="Import / export" value={formatImportExport(project)} />
          <Meta label="Target COD" value={project.targetCOD || "—"} />
          <Meta label="Last updated" value={<ClientAbsoluteDate iso={project.lastUpdated} />} />
          <Meta label="Case ID" value={project.connectionCase?.caseId ?? "Not opened"} mono />
        </dl>
      </div>

      <div className="relative z-10 overflow-x-auto px-4 pt-3 sm:px-6 lg:px-8">
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
        {tab === "overview" ? <OverviewTab project={project} sourceHealth={sourceHealth} /> : null}
        {tab === "grid" ? <GridTab project={project} sourceHealth={sourceHealth} /> : null}
        {tab === "connection" ? (
          <ConnectionTab project={project} operators={operators} />
        ) : null}
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
  sourceHealth,
}: {
  project: ProjectDetailViewModel;
  sourceHealth: SourceHealthView[];
}) {
  return (
    <div className="space-y-4">
      <DevelopmentBrief project={project} />
      <OfficialChangesSignal
        counts={project.officialChanges}
        href={`/changes?project=${encodeURIComponent(project.id)}`}
        sourceDelayed={sourceHealth.some((item) => isOfficialSourceUpdateDelayed(item.health))}
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <RequirementsManager project={project} />

        <div className="space-y-4">
          {project.alerts.length > 0 ? (
            <section className="overflow-hidden rounded-md border border-line bg-surface">
              <div className="border-b border-line px-5 py-3">
                <h2 className="text-base font-semibold">Open alerts</h2>
                <p className="text-sm text-muted">Alerts linked to this project.</p>
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
            <h2 className="text-base font-semibold">Project description</h2>
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
          {project.canDelete ? (
            <section className="rounded-md border border-critical/30 bg-critical-bg/40 p-5">
              <h2 className="text-base font-semibold text-critical">Danger zone</h2>
              <p className="mt-2 text-sm text-muted">
                Hard delete permanently removes this project. Archive is the normal way to take a
                site out of the active portfolio.
              </p>
              <div className="mt-4">
                <DeleteProjectButton projectId={project.id} projectName={project.name} />
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GridTab({
  project,
  sourceHealth,
}: {
  project: ProjectDetailViewModel;
  sourceHealth: SourceHealthView[];
}) {
  const context = project.officialGridAreaContext;
  const area = context?.areas[0] ?? null;
  const provenance = context?.provenance ?? null;
  const officialCompany = area?.officialOperatorName ?? null;
  const operatorsDiffer =
    Boolean(project.gridOperator) &&
    Boolean(officialCompany) &&
    project.gridOperator !== officialCompany;
  const permittedVoltage =
    area?.permittedVoltageKv != null && Number.isFinite(area.permittedVoltageKv)
      ? `${Number.isInteger(area.permittedVoltageKv) ? String(area.permittedVoltageKv) : area.permittedVoltageKv.toString()} kV`
      : null;

  return (
    <div className="space-y-4">
      <OfficialDataFreshnessStrip
        localNetwork={context}
        nup={project.officialNetworkDevelopmentPlanContext}
      />
      <OfficialGeographicContextSection
        slug={project.slug}
        latitude={context?.coordinate?.latitude ?? (project.hasCoordinates ? project.latitude : null)}
        longitude={context?.coordinate?.longitude ?? (project.hasCoordinates ? project.longitude : null)}
        localNetwork={context}
        nup={project.officialNetworkDevelopmentPlanContext}
        sourceHealth={sourceHealth}
      />
      <OfficialChangesSignal
        counts={project.officialChanges}
        href={`/changes?project=${encodeURIComponent(project.id)}`}
        sourceDelayed={sourceHealth.some((item) => isOfficialSourceUpdateDelayed(item.health))}
      />
      <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <section className="rounded-md border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Project connection</h2>
            <QuietTag>Project data · Stored in NOXHEIM</QuietTag>
          </div>
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm">
            <Row
              label="Project / connection operator"
              value={project.gridOperator || "—"}
            />
            <Row label="Connection stage" value={<StageBadge stage={project.stage} />} />
            <Row label="Import" value={project.importMW > 0 ? `${project.importMW} MW` : "—"} />
            <Row label="Export" value={project.exportMW > 0 ? `${project.exportMW} MW` : "—"} />
            <Row
              label="Customer voltage level"
              value={project.voltageLevel || "—"}
            />
            <Row label="Team outlook" value={<OutlookBadge outlook={project.outlook} />} />
            <Row label="Team confidence" value={<ConfidenceBadge confidence={project.confidence} />} />
          </dl>
          <p className="mt-4 text-xs leading-5 text-muted">
            Operator, voltage level, outlook and confidence are customer-entered. They are not
            derived from Ei local-network or NUP geography and may differ from official companies
            and permitted voltage shown below.
          </p>
        </section>

        <section className="rounded-md border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Official local network context</h2>
            <div className="flex flex-wrap items-center gap-2">
              <SourceBadge source="Official" />
              <QuietTag>Official source</QuietTag>
            </div>
          </div>
          {area ? (
            <>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm">
                <Row label="Official local network company" value={officialCompany || "—"} />
                <Row label="Area / concession name" value={area.name || "—"} />
                <Row
                  label="Concession ID"
                  value={
                    area.concessionId ? (
                      <span className="font-mono text-[13px]">{area.concessionId}</span>
                    ) : (
                      "—"
                    )
                  }
                />
                <Row label="Area type" value={gridAreaTypeLabel(area.areaType)} />
                {permittedVoltage ? (
                  <Row label="Permitted voltage" value={permittedVoltage} />
                ) : null}
              </dl>
              {operatorsDiffer ? (
                <p className="mt-4 text-sm leading-6 text-muted">
                  The project&apos;s connection operator and the local network area operator differ.
                  This can be expected where a project connects at another voltage or network level.
                </p>
              ) : null}
              <p className="mt-3">
                <QuietTag>NOXHEIM derived · Geographic project-to-area match</QuietTag>
              </p>
            </>
          ) : (
            <div className="mt-3">
              <p className="text-sm font-medium">No local network area match</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                NOXHEIM did not find an official Ei local-network geometry covering this project
                coordinate in the current dataset.
              </p>
            </div>
          )}
        </section>
      </div>

      <div className="space-y-4">
        <section className="rounded-md border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Source</h2>
            {provenance?.publisher ? (
              <QuietTag>Official source · {provenance.publisher}</QuietTag>
            ) : null}
          </div>
          {provenance ? (
            <>
              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm">
                <Row label="Publisher" value={provenance.publisher || "—"} />
                <Row label="Source type" value={gridSourceTypeLabel(provenance.sourceType)} />
                <Row label="Authority" value={gridAuthorityLabel(provenance.authorityLevel)} />
                <Row
                  label="Dataset"
                  value={provenance.dataType || "Network area concession geography"}
                />
                <Row
                  label="Dataset updated"
                  value={provenance.publishedAt ? formatDate(provenance.publishedAt) : "—"}
                />
                <Row
                  label="Retrieved by NOXHEIM"
                  value={provenance.retrievedAt ? formatDate(provenance.retrievedAt) : "—"}
                />
                <Row
                  label="Confidence"
                  value={<ConfidenceBadge confidence={confidenceLabel(provenance.confidence)} />}
                />
              </dl>
              {provenance.sourceUrl ? (
                <p className="mt-4">
                  <a
                    href={provenance.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-teal hover:underline"
                  >
                    View source
                  </a>
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Official source provenance is not available for this project yet.
            </p>
          )}
        </section>
      </div>
      </div>

      <OfficialNetworkDevelopmentPlanSection
        nup={project.officialNetworkDevelopmentPlanContext}
        localNetwork={context}
      />

      <section className="rounded-md border border-line bg-canvas p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          How to read this
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>
            <span className="font-medium text-ink">Project data</span>
            {" · "}Customer/project workflow information stored in NOXHEIM
          </li>
          <li>
            <span className="font-medium text-ink">Official source</span>
            {" · "}Ei local-network concession geography and Ei network development plans
          </li>
          <li>
            <span className="font-medium text-ink">NOXHEIM derived</span>
            {" · "}Spatial project-to-area matching
          </li>
        </ul>
        <p className="mt-4 text-xs leading-5 text-muted">
          Official network-area and network-development-plan information provides geographic
          and planning context. Forecast transfer needs, planned investments and planning
          assessments do not indicate available grid capacity or guarantee connection
          feasibility. Formal assessment by the relevant grid operator is required.
        </p>
      </section>
    </div>
  );
}

function QuietTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
      {children}
    </span>
  );
}

function ConnectionTab({
  project,
  operators,
}: {
  project: ProjectDetailViewModel;
  operators: GridOperatorOption[];
}) {
  const current = project.stage;
  const params = useSearchParams();
  const currentIndex = OVERVIEW_PIPELINE_STAGES.indexOf(current);
  const connectionCase = project.connectionCase;
  const editRequested = params.get("edit") === "1";
  const submitted = project.requirements
    .filter((item) => item.status === "Complete")
    .map((item) => item.label);
  const missing = project.requirements
    .filter((item) => item.status === "Missing")
    .map((item) => item.label);
  const requirementLabels = project.requirements.map((item) => item.label);

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Connection process</h2>
        <p className="mt-1 text-sm text-muted">
          Stored project stage (customer entered). Change it from Edit project or the connection
          case below.
        </p>
        <ol className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {OVERVIEW_PIPELINE_STAGES.map((stage, index) => {
            const state =
              index < currentIndex ? "completed" : index === currentIndex ? "active" : "pending";
            return (
              <li
                key={stage}
                className={cn(
                  "min-w-[120px] flex-1 rounded-md border px-3 py-2 text-left text-sm",
                  state === "completed" && "border-success bg-success-bg text-success",
                  state === "active" && "border-teal bg-teal-soft text-teal",
                  state === "pending" && "border-line bg-canvas text-muted",
                )}
              >
                <p className="text-[10px] uppercase tracking-wide opacity-80">
                  {state === "completed" ? "Reached" : state === "active" ? "Current" : "Later"}
                </p>
                <p className="mt-1 font-medium">{stage}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <ConnectionCasePanel
        project={project}
        operators={operators}
        initialMode={editRequested && connectionCase ? "edit" : "view"}
      />

      {connectionCase ? (
        <section className="rounded-md border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold">Requirements linked to this process</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <ListBlock title="Requirements" items={requirementLabels} />
            <ListBlock title="Submitted" items={submitted} />
            <ListBlock title="Missing" items={missing} empty="None outstanding" />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function DocumentsTab({ project }: { project: ProjectDetailViewModel }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Customer-provided project files, stored privately for this workspace. These are not
        official grid records. Files are not malware-scanned.
      </p>
      {project.canEdit ? (
        <DocumentUploadForm
          projects={[{ id: project.id, name: project.name }]}
          defaultProjectId={project.id}
          compact
        />
      ) : null}
      {project.documents.length === 0 ? (
        <EmptyState
          title="No documents on this project yet"
          description={
            project.canEdit
              ? "Upload a PDF, Word, Excel, or image file to keep it with this project."
              : "No files have been uploaded to this project yet."
          }
        />
      ) : (
        <DocumentTable
          rows={project.documents.map((doc) => ({
            id: doc.id,
            name: doc.name,
            category: doc.category,
            status: doc.status,
            fileKind: doc.fileKind,
            fileSizeBytes: doc.fileSizeBytes,
            uploadedAt: doc.uploadedAt,
            uploadedByName: doc.uploadedByName ?? doc.owner,
            hasStoredFile: doc.hasStoredFile,
          }))}
          canWrite={project.canEdit}
        />
      )}
    </div>
  );
}

function ActivityTab({ project }: { project: ProjectDetailViewModel }) {
  const nowMs = useSyncExternalStore(
    () => () => {},
    () => Date.now(),
    () => null,
  );

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
              <span className="text-xs text-muted">
                {nowMs
                  ? formatRelative(event.occurredAt, new Date(nowMs))
                  : formatDate(event.occurredAt)}
              </span>
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
