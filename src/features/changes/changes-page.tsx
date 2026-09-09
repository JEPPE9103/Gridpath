"use client";

import { BellButton } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState, EmptyWorkspaceAction } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast-provider";
import { updateChangeImpactReview } from "@/lib/changes/actions";
import { cn } from "@/lib/cn";
import type {
  GridChangeImpactView,
  GridChangesResult,
  OfficialChangeImpactCard,
  OrganizationGridChange,
} from "@/lib/data/grid-changes-types";
import { OFFICIAL_EI_NUP_SOURCE_SLUG } from "@/lib/domain/grid-intelligence";
import { reviewStatusLabel } from "@/lib/domain/grid-change-presentation";
import {
  GEOGRAPHIC_OVERLAP_EXPLANATION,
  NUP_FORECAST_NEED_CHANGE_DISCLAIMER,
  officialSourceDelayMessage,
  paginateItems,
} from "@/lib/domain/official-change-summary";
import { formatDate } from "@/lib/format";
import type { ChangeReviewStatus } from "@/lib/domain/grid-intelligence";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";

const PAGE_SIZE = 25;
const REVIEW_TABS: Array<{ id: ChangeReviewStatus | "all"; label: string }> = [
  { id: "unreviewed", label: "To review" },
  { id: "confirmed", label: "Confirmed" },
  { id: "dismissed", label: "Dismissed" },
  { id: "all", label: "All" },
];

export function ChangesPage({
  result,
  headerDate,
  initialStatus,
  initialProjectId,
  initialImpactId,
  initialPage,
}: {
  result: GridChangesResult;
  headerDate: string;
  initialStatus?: string;
  initialProjectId?: string;
  initialImpactId?: string | null;
  initialPage?: number;
}) {
  if (result.kind === "no_organization") {
    return (
      <>
        <PageHeader title="Changes" subtitle={inboxSubtitle()} actions={<HeaderDate date={headerDate} />} />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="No workspace yet"
            description="This account is not a member of an organisation. Join a workspace to review official publication matches."
            action={<EmptyWorkspaceAction />}
          />
        </div>
      </>
    );
  }

  if (result.kind === "error") {
    return (
      <>
        <PageHeader title="Changes" subtitle={inboxSubtitle()} actions={<HeaderDate date={headerDate} />} />
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
      result={result}
      headerDate={headerDate}
      initialStatus={parseStatus(initialStatus)}
      initialProjectId={initialProjectId ?? "All"}
      initialImpactId={initialImpactId ?? null}
      initialPage={initialPage ?? 1}
    />
  );
}

function LoadedChangesPage({
  result,
  headerDate,
  initialStatus,
  initialProjectId,
  initialImpactId,
  initialPage,
}: {
  result: Extract<GridChangesResult, { kind: "ok" }>;
  headerDate: string;
  initialStatus: ChangeReviewStatus | "all";
  initialProjectId: string;
  initialImpactId: string | null;
  initialPage: number;
}) {
  const [statusFilter, setStatusFilter] = useState<ChangeReviewStatus | "all">(initialStatus);
  const [projectFilter, setProjectFilter] = useState(initialProjectId);
  const [sourceFilter, setSourceFilter] = useState("All");
  const [selectedImpactId, setSelectedImpactId] = useState<string | null>(initialImpactId);
  const [page, setPage] = useState(initialPage);

  const projectOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const card of result.impacts) {
      if (card.impact.project) names.set(card.impact.project.id, card.impact.project.name);
    }
    return [...names.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [result.impacts]);

  const sourceOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const card of result.impacts) names.set(card.change.source.slug, card.change.source.name);
    return [...names.entries()].sort((left, right) => left[1].localeCompare(right[1]));
  }, [result.impacts]);

  const filtered = useMemo(
    () =>
      result.impacts.filter((card) => {
        const matchesStatus = statusFilter === "all" || card.impact.reviewStatus === statusFilter;
        const matchesProject =
          projectFilter === "All" || card.impact.project?.id === projectFilter;
        const matchesSource = sourceFilter === "All" || card.change.source.slug === sourceFilter;
        return matchesStatus && matchesProject && matchesSource;
      }),
    [result.impacts, statusFilter, projectFilter, sourceFilter],
  );

  const paged = paginateItems(filtered, page, PAGE_SIZE);
  const selected = filtered.find((card) => card.impact.id === selectedImpactId) ?? null;
  const delayedSources = result.sourceHealth.filter((item) => item.delayed);
  const nupBaseline = result.sourceBaselines.find((item) => item.slug === OFFICIAL_EI_NUP_SOURCE_SLUG);

  return (
    <>
      <PageHeader
        title="Changes"
        subtitle={inboxSubtitle()}
        actions={
          <>
            <BellButton />
            <HeaderDate date={headerDate} />
          </>
        }
      />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <div className="flex flex-wrap gap-2">
          {REVIEW_TABS.map((tab) => {
            const count =
              tab.id === "all"
                ? result.counts.unreviewed + result.counts.confirmed + result.counts.dismissed
                : result.counts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm",
                  statusFilter === tab.id
                    ? "border-teal bg-teal-soft text-teal"
                    : "border-line bg-surface text-muted",
                )}
              >
                {count} {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <FilterSelect
            label="Project"
            value={projectFilter}
            onChange={(value) => {
              setProjectFilter(value);
              setPage(1);
            }}
            options={[
              { value: "All", label: "All" },
              ...projectOptions.map(([id, name]) => ({ value: id, label: name })),
            ]}
          />
          <FilterSelect
            label="Source"
            value={sourceFilter}
            onChange={(value) => {
              setSourceFilter(value);
              setPage(1);
            }}
            options={[
              { value: "All", label: "All" },
              ...sourceOptions.map(([slug, name]) => ({ value: slug, label: name })),
            ]}
          />
        </div>

        {delayedSources.length > 0 ? (
          <p className="rounded-md border border-warning/40 bg-warning-bg/60 px-3 py-2 text-sm text-warning">
            {officialSourceDelayMessage(delayedSources.length)}
            {delayedSources.map((item) => ` · ${item.name}`).join("")}
          </p>
        ) : null}

        {paged.total === 0 ? (
          statusFilter === "unreviewed" && projectFilter === "All" && sourceFilter === "All" ? (
            <EmptyState
            title="No official changes to review"
            description="NOXHEIM compares supported official publications over time. When a supported Ei record changes and geographically matches one of your projects, it will appear here for review."
            />
          ) : (
            <EmptyState
              title="No impacts match these filters"
              description="Try another review status, project or source."
            />
          )
        ) : (
          <ol className="space-y-3">
            {paged.items.map((card) => (
              <ImpactCard
                key={card.impact.id}
                card={card}
                selected={selected?.impact.id === card.impact.id}
                canWrite={result.canWrite}
                onOpen={() => setSelectedImpactId(card.impact.id)}
              />
            ))}
          </ol>
        )}

        {paged.pageCount > 1 ? (
          <div className="flex items-center gap-2 text-sm">
            <Button variant="secondary" disabled={paged.page <= 1} onClick={() => setPage(paged.page - 1)}>
              Previous
            </Button>
            <span className="text-muted">
              Page {paged.page} of {paged.pageCount}
            </span>
            <Button
              variant="secondary"
              disabled={paged.page >= paged.pageCount}
              onClick={() => setPage(paged.page + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}

        {selected ? (
          <ImpactDetail card={selected} canWrite={result.canWrite} onClose={() => setSelectedImpactId(null)} />
        ) : null}

        {nupBaseline ? (
          <p className="text-xs leading-5 text-muted">
            Latest successful source check: {nupBaseline.name}
            {nupBaseline.lastRetrievedAtLabel ? ` · ${nupBaseline.lastRetrievedAtLabel}` : ""}.
            Geographic overlap is covering geography, not a connection point.
          </p>
        ) : null}

        {result.sourceHealth.length > 0 ? (
          <ul className="text-xs text-muted">
            {result.sourceHealth.map((item) => (
              <li key={item.slug}>
                {item.name}: {item.delayed ? "Currently delayed" : item.healthLabel}
                {item.changeLabel !== "—" ? ` · ${item.changeLabel}` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );
}

function ImpactCard({
  card,
  selected,
  canWrite,
  onOpen,
}: {
  card: OfficialChangeImpactCard;
  selected: boolean;
  canWrite: boolean;
  onOpen: () => void;
}) {
  const { change, impact } = card;
  return (
    <li
      className={cn(
        "rounded-md border bg-surface p-5",
        selected ? "border-teal" : "border-line",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Official change</p>
          <h2 className="mt-1 text-base font-semibold">{impact.project?.name ?? "Matched project"}</h2>
          <p className="mt-1 text-sm text-muted">
            {change.source.name}
            {change.area?.officialCompany ? ` · ${change.area.officialCompany}` : ""}
          </p>
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
      <p className="mt-3 text-sm leading-6">{change.deterministicSummary}</p>
      <BeforeAfter change={change} />
      <p className="mt-3 text-xs leading-5 text-muted">
        Publisher: {change.provenance.publisher ?? "Energimarknadsinspektionen"} · Detected by NOXHEIM{" "}
        {change.detectedAtLabel}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted">{GEOGRAPHIC_OVERLAP_EXPLANATION}</p>
      {change.source.slug === OFFICIAL_EI_NUP_SOURCE_SLUG ? (
        <p className="mt-2 text-xs leading-5 text-muted">{NUP_FORECAST_NEED_CHANGE_DISCLAIMER}</p>
      ) : null}
      <div className="mt-4">
        <Button type="button" variant="secondary" onClick={onOpen}>
          Review impact
        </Button>
      </div>
      {!canWrite ? <p className="mt-2 text-xs text-muted">Review is read-only for this role.</p> : null}
    </li>
  );
}

function ImpactDetail({
  card,
  canWrite,
  onClose,
}: {
  card: OfficialChangeImpactCard;
  canWrite: boolean;
  onClose: () => void;
}) {
  const { change, impact } = card;
  const mapHref = impact.project
    ? `/map?project=${encodeURIComponent(impact.project.slug)}&change=${encodeURIComponent(impact.id)}`
    : "/map";
  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Impact detail</p>
          <h2 className="mt-1 text-base font-semibold">{impact.project?.name ?? "Project"}</h2>
        </div>
        <button type="button" className="text-sm text-muted hover:text-ink" onClick={onClose}>
          Close
        </button>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Row label="Project" value={impact.project?.name ?? "—"} />
        <Row label="Location" value={impact.project?.location || "—"} />
        <Row label="Official area" value={change.area?.name ?? "—"} />
        <Row label="Official company" value={change.area?.officialCompany ?? "—"} />
      </dl>
      <p className="mt-4 text-sm leading-6">{change.deterministicSummary}</p>
      <BeforeAfter change={change} />
      <p className="mt-3 text-sm leading-6">{GEOGRAPHIC_OVERLAP_EXPLANATION}</p>
      <p className="mt-3 text-xs leading-5 text-muted">{NUP_FORECAST_NEED_CHANGE_DISCLAIMER}</p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <Row label="Publisher" value={change.provenance.publisher ?? "—"} />
        <Row label="Dataset" value={change.source.name} />
        <Row label="Published / source date" value={change.publishedAtLabel ?? "—"} />
        <Row label="Retrieved by NOXHEIM" value={change.provenance.currentSnapshotAtLabel} />
        <Row label="Team review" value={reviewStatusLabel(impact.reviewStatus)} />
        <Row label="Reviewer" value={impact.reviewedByName ?? "—"} />
        <Row label="Reviewed at" value={impact.reviewedAt ? formatDate(impact.reviewedAt) : "—"} />
        <Row label="Team note" value={impact.reviewNote ?? "—"} />
      </dl>
      {change.provenance.officialSourceUrl ? (
        <p className="mt-3 text-sm">
          <a href={change.provenance.officialSourceUrl} className="text-teal hover:underline" target="_blank" rel="noreferrer">
            Official source
          </a>
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {impact.project ? (
          <>
            <Link href={`/projects/${impact.project.slug}`}>
              <Button variant="secondary">View project</Button>
            </Link>
            <Link href={`/projects/${impact.project.slug}?tab=grid`}>
              <Button variant="secondary">View Grid Intelligence</Button>
            </Link>
          </>
        ) : null}
        <Link href={mapHref}>
          <Button variant="secondary">View on Map</Button>
        </Link>
      </div>
      <ReviewActions impact={impact} canWrite={canWrite} />
    </section>
  );
}

function ReviewActions({
  impact,
  canWrite,
}: {
  impact: GridChangeImpactView;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [note, setNote] = useState(impact.reviewNote ?? "");
  const [isPending, startTransition] = useTransition();

  function onReview(status: ChangeReviewStatus) {
    if (!canWrite) return;
    startTransition(async () => {
      const result = await updateChangeImpactReview(impact.id, status, note);
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
        title: status === "confirmed" ? "Marked relevant" : "Dismissed",
        description:
          status === "confirmed"
            ? "Your team believes this official change is relevant to this project. NOXHEIM has not verified a technical grid impact."
            : "This organisation reviewed this matched change and does not currently consider it relevant.",
        tone: "success",
      });
    });
  }

  if (!canWrite) {
    return <p className="mt-3 text-xs text-muted">Review is read-only for this role.</p>;
  }

  return (
    <div className="mt-4 space-y-2">
      <label className="block text-sm">
        <span className="text-xs text-muted">Optional team note</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={500}
          className="mt-1 w-full rounded-md border border-line bg-canvas px-3 py-2 text-sm"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={isPending || impact.reviewStatus === "confirmed"} onClick={() => onReview("confirmed")}>
          Confirm relevant
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
    </div>
  );
}

function BeforeAfter({ change }: { change: OrganizationGridChange }) {
  if (!change.before && !change.after) return null;
  return (
    <div className="mt-3 grid gap-3 rounded-md border border-line bg-canvas p-3 sm:grid-cols-2">
      {change.before ? (
        <div>
          <p className="text-xs text-muted">Previous published value</p>
          <p className="text-sm font-medium">{change.before.empty ? "—" : change.before.display}</p>
        </div>
      ) : null}
      {change.after ? (
        <div>
          <p className="text-xs text-muted">New published value</p>
          <p className="text-sm font-medium">{change.after.empty ? "—" : change.after.display}</p>
        </div>
      ) : null}
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
      <select value={value} onChange={(event) => onChange(event.target.value)} className="bg-transparent">
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
  tone?: "official" | "derived" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tone === "official" && "bg-success-bg text-success",
        tone === "derived" && "bg-teal-soft text-teal",
        tone === "muted" && "bg-canvas text-muted",
      )}
    >
      {children}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function HeaderDate({ date }: { date: string }) {
  return <span className="hidden text-sm text-muted sm:inline">{date}</span>;
}

function inboxSubtitle() {
  return "Official publication changes geographically matched to your projects. Your team reviews relevance — NOXHEIM does not claim technical impact or available capacity.";
}

function parseStatus(value: string | undefined): ChangeReviewStatus | "all" {
  if (value === "confirmed" || value === "dismissed" || value === "all" || value === "unreviewed") {
    return value;
  }
  return "unreviewed";
}
