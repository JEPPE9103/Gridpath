"use client";

import { BellButton } from "@/components/layout/app-shell";
import { CountBadge, OutlookBadge, StageBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast-provider";
import { updateChangeImpactReview } from "@/lib/changes/actions";
import { cn } from "@/lib/cn";
import {
  CHANGE_REVIEW_FILTERS,
  CHANGE_SEVERITY_FILTERS,
  CHANGE_TYPE_FILTERS,
  type GridChangeImpactView,
  type GridChangesResult,
  type GridSourceBaselineView,
  type OrganizationGridChange,
} from "@/lib/data/grid-changes-types";
import { OFFICIAL_EI_NUP_SOURCE_SLUG } from "@/lib/domain/grid-intelligence";
import {
  changeSeverityLabel,
  changeTypeLabel,
  reviewStatusLabel,
} from "@/lib/domain/grid-change-presentation";
import { formatImportExport } from "@/lib/format";
import type { ChangeReviewStatus } from "@/lib/domain/grid-intelligence";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";

export function ChangesPage({
  result,
  headerDate,
}: {
  result: GridChangesResult;
  headerDate: string;
}) {
  if (result.kind === "no_organization") {
    return (
      <>
        <PageHeader
          title="Changes"
          subtitle="Published grid and network-planning updates mapped to your development portfolio. Official layers are refreshed by NOXHEIM operations for this pilot."
          actions={<span className="hidden text-sm text-muted sm:inline">{headerDate}</span>}
        />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="No workspace yet"
            description="This account is not a member of an organisation. Join a workspace to see grid-intelligence changes mapped to your portfolio."
          />
        </div>
      </>
    );
  }

  if (result.kind === "error") {
    return (
      <>
        <PageHeader
          title="Changes"
          subtitle="Published grid and network-planning updates mapped to your development portfolio. Official layers are refreshed by NOXHEIM operations for this pilot."
          actions={<span className="hidden text-sm text-muted sm:inline">{headerDate}</span>}
        />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="Could not load changes"
            description="Try again in a moment. If the problem continues, sign in again."
          />
        </div>
      </>
    );
  }

  return (
    <LoadedChangesPage
      changes={result.changes}
      sourceBaselines={result.sourceBaselines}
      canWrite={result.canWrite}
      headerDate={headerDate}
    />
  );
}

function LoadedChangesPage({
  changes,
  sourceBaselines,
  canWrite,
  headerDate,
}: {
  changes: OrganizationGridChange[];
  sourceBaselines: GridSourceBaselineView[];
  canWrite: boolean;
  headerDate: string;
}) {
  const [sourceFilter, setSourceFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [reviewFilter, setReviewFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");

  const sourceOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const baseline of sourceBaselines) {
      names.set(baseline.slug, baseline.name);
    }
    for (const change of changes) {
      names.set(change.source.slug, change.source.name);
    }
    return [...names.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [changes, sourceBaselines]);

  const projectOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const change of changes) {
      for (const impact of change.impacts) {
        if (impact.project) {
          names.set(impact.project.id, impact.project.name);
        }
      }
    }
    return [...names.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [changes]);

  const typeOptions = useMemo(() => {
    const present = new Set(changes.map((change) => change.changeType));
    return CHANGE_TYPE_FILTERS.filter((item) => present.has(item));
  }, [changes]);

  const filtered = useMemo(() => {
    return changes.filter((change) => {
      const matchesSource = sourceFilter === "All" || change.source.slug === sourceFilter;
      const matchesType = typeFilter === "All" || change.changeType === typeFilter;
      const matchesSeverity = severityFilter === "All" || change.severity === severityFilter;
      const matchesProject =
        projectFilter === "All" ||
        change.impacts.some((impact) => impact.project?.id === projectFilter);
      const matchesReview =
        reviewFilter === "All" ||
        change.impacts.some((impact) => impact.reviewStatus === reviewFilter);
      return matchesSource && matchesType && matchesSeverity && matchesProject && matchesReview;
    });
  }, [changes, sourceFilter, typeFilter, severityFilter, projectFilter, reviewFilter]);

  const officialBaseline = sourceBaselines.find(
    (item) => item.slug === OFFICIAL_EI_NUP_SOURCE_SLUG,
  );
  const filtersActive =
    sourceFilter !== "All" ||
    typeFilter !== "All" ||
    projectFilter !== "All" ||
    reviewFilter !== "All" ||
    severityFilter !== "All";
  const officialFilterEmpty =
    filtered.length === 0 &&
    sourceFilter === OFFICIAL_EI_NUP_SOURCE_SLUG &&
    (officialBaseline?.baselineEstablished ?? false);

  return (
    <>
      <PageHeader
        title="Changes"
        subtitle="Published grid and network-planning updates mapped to your development portfolio. Official layers are refreshed by NOXHEIM operations for this pilot."
        actions={
          <>
            <BellButton />
            <span className="hidden text-sm text-muted sm:inline">{headerDate}</span>
          </>
        }
      />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        {sourceBaselines.length > 0 ? (
          <section className="rounded-md border border-line bg-canvas px-4 py-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Official source baseline
            </p>
            <div className="mt-2 space-y-2">
              {sourceBaselines.map((baseline) => (
                <dl key={baseline.slug} className="grid gap-1 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted">Source</dt>
                    <dd className="font-medium text-ink">{baseline.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Baseline established</dt>
                    <dd className="font-medium text-ink">
                      {baseline.classification === "official" && baseline.baselineEstablished
                        ? baseline.lastRetrievedAtLabel ?? "Yes"
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Last retrieved</dt>
                    <dd className="font-medium text-ink">
                      {baseline.lastRetrievedAtLabel ?? "—"}
                    </dd>
                  </div>
                </dl>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">
              Future official source snapshots are compared against this baseline. Relevant changes
              are matched to portfolio projects when detected. Official source data is refreshed by
              NOXHEIM operations during the design partner phase.
            </p>
          </section>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <FilterSelect
            label="Source"
            value={sourceFilter}
            onChange={setSourceFilter}
            options={[
              { value: "All", label: "All" },
              ...sourceOptions.map(([slug, name]) => ({ value: slug, label: name })),
            ]}
          />
          <FilterSelect
            label="Change type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: "All", label: "All" },
              ...(typeOptions.length > 0 ? typeOptions : CHANGE_TYPE_FILTERS).map((item) => ({
                value: item,
                label: changeTypeLabel(item),
              })),
            ]}
          />
          <FilterSelect
            label="Project"
            value={projectFilter}
            onChange={setProjectFilter}
            options={[
              { value: "All", label: "All" },
              ...projectOptions.map(([id, name]) => ({ value: id, label: name })),
            ]}
          />
          <FilterSelect
            label="Review"
            value={reviewFilter}
            onChange={setReviewFilter}
            options={[
              { value: "All", label: "All" },
              ...CHANGE_REVIEW_FILTERS.map((item) => ({
                value: item,
                label: reviewStatusLabel(item),
              })),
            ]}
          />
          <FilterSelect
            label="Severity"
            value={severityFilter}
            onChange={setSeverityFilter}
            options={[
              { value: "All", label: "All" },
              ...CHANGE_SEVERITY_FILTERS.map((item) => ({
                value: item,
                label: changeSeverityLabel(item),
              })),
            ]}
          />
        </div>

        {filtered.length === 0 ? (
          officialFilterEmpty ? (
            <EmptyState
              title="No changes have been detected since the current official baseline was established."
              description="The official baseline is in place. Later source snapshots are compared with the previous version, and relevant geographic changes are mapped to portfolio projects."
            />
          ) : changes.length === 0 ? (
            <EmptyState
              title="No portfolio-mapped changes yet"
              description="When published grid information changes and NOXHEIM can match it to a project in this organisation, it will appear here."
            />
          ) : filtersActive ? (
            <EmptyState
              title="No changes match these filters"
              description="Try another source, change type, project or review status."
            />
          ) : (
            <EmptyState
              title="No portfolio-mapped changes yet"
              description="When published grid information changes and NOXHEIM can match it to a project in this organisation, it will appear here."
            />
          )
        ) : (
          <ol className="space-y-3">
            {filtered.map((change) => (
              <ChangeCard key={change.id} change={change} canWrite={canWrite} />
            ))}
          </ol>
        )}
      </div>
    </>
  );
}

function ChangeCard({
  change,
  canWrite,
}: {
  change: OrganizationGridChange;
  canWrite: boolean;
}) {
  const fixture = change.source.classification === "fixture";
  const official = change.source.classification === "official";

  return (
    <li className="rounded-md border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">{change.changeTypeLabel}</p>
          <h2 className="mt-1 text-base font-semibold">{change.title}</h2>
        </div>
        <div className="text-right text-xs text-muted">
          <p>{change.source.name}</p>
          <p className="mt-1">{change.detectedAtLabel}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {fixture ? (
          <>
            <QuietTag tone="fixture">Development fixture</QuietTag>
            <QuietTag tone="fixture">Not real grid data</QuietTag>
          </>
        ) : null}
        {official ? <QuietTag tone="official">Official source</QuietTag> : null}
        <QuietTag>{change.source.authorityLabel}</QuietTag>
        <QuietTag>{change.changeKindLabel}</QuietTag>
      </div>

      {change.summary ? (
        <p className="mt-2 text-sm leading-6 text-ink/90">{change.summary}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CountBadge tone="teal">
          Affected projects {change.affectedProjectCount}
        </CountBadge>
        <CountBadge>
          Review {change.reviewSummary}
        </CountBadge>
      </div>

      <BeforeAfter change={change} />
      <AreaBlock area={change.area} />

      <div className="mt-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Affected projects
        </p>
        {change.impacts.map((impact) => (
          <ImpactBlock key={impact.id} impact={impact} canWrite={canWrite} />
        ))}
      </div>

      <details className="mt-4 rounded-md border border-line bg-canvas px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-ink">Provenance</summary>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <ProvenanceRow label="Publisher" value={change.provenance.publisher ?? "—"} />
          <ProvenanceRow label="Source" value={change.provenance.sourceName} />
          <ProvenanceRow label="Authority" value={change.provenance.authorityLabel} />
          <ProvenanceRow
            label="Planning area"
            value={change.provenance.planningAreaName ?? "Not available"}
          />
          <ProvenanceRow
            label="Previous snapshot"
            value={change.provenance.previousSnapshotAtLabel}
          />
          <ProvenanceRow
            label="Current snapshot"
            value={change.provenance.currentSnapshotAtLabel}
          />
          <ProvenanceRow label="Detected by" value={change.provenance.detectedBy} />
          <ProvenanceRow label="Confidence" value={change.provenance.confidenceLabel} />
        </dl>
        {change.provenance.officialSourceUrl ? (
          <p className="mt-2 text-sm">
            <a
              href={change.provenance.officialSourceUrl}
              className="text-teal hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Official source
            </a>
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">No official source link is stored for this change.</p>
        )}
      </details>
    </li>
  );
}

function BeforeAfter({ change }: { change: OrganizationGridChange }) {
  const before = change.before;
  const after = change.after;
  if (!before && !after) {
    return null;
  }

  return (
    <div className="mt-4 rounded-md border border-line bg-canvas p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {change.changeKindLabel}
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {before ? (
          <div>
            <p className="text-xs text-muted">{before.semanticLabel}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted">Before</p>
            <p className="text-sm font-medium text-ink">{before.empty ? "—" : before.display}</p>
          </div>
        ) : null}
        {after ? (
          <div>
            <p className="text-xs text-muted">{after.semanticLabel}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted">After</p>
            <p className="text-sm font-medium text-ink">{after.empty ? "—" : after.display}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AreaBlock({ area }: { area: OrganizationGridChange["area"] }) {
  if (!area) {
    return (
      <p className="mt-3 text-xs text-muted">No planning-area geometry is stored for this change.</p>
    );
  }
  if (area.missing) {
    return (
      <p className="mt-3 text-xs text-muted">Planning area is not available for this change.</p>
    );
  }
  return (
    <div className="mt-3">
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <ProvenanceRow label="Planning area" value={area.name} />
        <ProvenanceRow label="Area type" value={area.areaTypeLabel} />
        {area.officialCompany ? (
          <ProvenanceRow label="Official company" value={area.officialCompany} />
        ) : null}
        {area.accountingUnit ? <ProvenanceRow label="REL" value={area.accountingUnit} /> : null}
        {area.planningScope ? (
          <ProvenanceRow label="Delområde" value={area.planningScope} />
        ) : null}
      </dl>
      {!area.hasGeometry ? (
        <p className="mt-2 text-xs text-muted">
          No area geometry is stored for this change.
        </p>
      ) : null}
    </div>
  );
}

function ImpactBlock({
  impact,
  canWrite,
}: {
  impact: GridChangeImpactView;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();

  function onReview(status: ChangeReviewStatus) {
    if (!canWrite) {
      return;
    }
    startTransition(async () => {
      const result = await updateChangeImpactReview(impact.id, status);
      if (!result.ok) {
        pushToast({
          title: "Could not update review",
          description: "The review status was not saved.",
          tone: "warning",
        });
        return;
      }
      router.refresh();
      pushToast({
        title: status === "confirmed" ? "Relevance confirmed" : "Change dismissed",
        description:
          status === "confirmed"
            ? "This organisation has confirmed that the source change is relevant to the project. The publisher did not make that determination."
            : "This organisation has dismissed the NOXHEIM match for this project.",
        tone: "success",
      });
    });
  }

  return (
    <div className="rounded-md border border-line bg-canvas p-3">
      {impact.project ? (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Link
              href={`/projects/${impact.project.slug}`}
              className="text-sm font-medium text-ink hover:text-teal"
            >
              {impact.project.name}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <StageBadge stage={impact.project.stage} />
              <OutlookBadge outlook={impact.project.outlook} />
              <span className="text-xs text-muted">
                {formatImportExport({
                  importMW: impact.project.importMW,
                  exportMW: impact.project.exportMW,
                })}
              </span>
            </div>
          </div>
          <QuietTag
            tone={
              impact.reviewStatus === "confirmed"
                ? "official"
                : impact.reviewStatus === "dismissed"
                  ? "muted"
                  : "derived"
            }
          >
            {reviewStatusLabel(impact.reviewStatus)}
          </QuietTag>
        </div>
      ) : (
        <p className="text-sm text-muted">This project is no longer in the organisation portfolio.</p>
      )}

      <div className="mt-3 rounded-md bg-surface px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <QuietTag tone="derived">NOXHEIM derived</QuietTag>
          <span className="text-[11px] uppercase tracking-wide text-muted">
            Why NOXHEIM matched this project
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          <ProvenanceRow label="Match type" value={impact.matchTypeLabel} />
          <ProvenanceRow label="Confidence" value={impact.confidenceLabel} />
        </dl>
        <p className="mt-2 text-sm leading-6 text-ink/90">{impact.reason}</p>
        <p className="mt-1 text-xs text-muted">
          The official publisher did not determine project impact. NOXHEIM derived this match.
        </p>
      </div>

      {canWrite ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={isPending || impact.reviewStatus === "confirmed"}
            onClick={() => onReview("confirmed")}
          >
            Confirm relevance
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isPending || impact.reviewStatus === "dismissed"}
            onClick={() => onReview("dismissed")}
          >
            Dismiss
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">Review is read-only for this role.</p>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2 text-sm">
      <span className="text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function QuietTag({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "fixture" | "official" | "derived" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tone === "fixture" && "bg-warning-bg text-warning",
        tone === "official" && "bg-success-bg text-success",
        tone === "derived" && "bg-teal-soft text-teal",
        tone === "muted" && "bg-canvas text-muted",
      )}
    >
      {children}
    </span>
  );
}

function ProvenanceRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}
