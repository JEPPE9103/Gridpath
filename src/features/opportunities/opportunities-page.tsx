"use client";

import { BellButton } from "@/components/layout/app-shell";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState, EmptyWorkspaceAction, ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  Metric,
  MetricStrip,
  PageBody,
  SectionHeader,
  tableCellClass,
  tableHeadCellClass,
  tableHeadClass,
  tableWrapClass,
} from "@/components/ui/workspace";
import type {
  OpportunityListItem,
  OpportunityOverview,
  OpportunitySearchListItem,
} from "@/lib/data/opportunities";
import {
  EMPTY_OPPORTUNITIES_DESCRIPTION,
  EMPTY_OPPORTUNITIES_TITLE,
} from "@/lib/opportunities/evidence-coverage";
import {
  opportunityConfidenceLabel,
  opportunityRecommendationLabel,
  opportunityStatusLabel,
  opportunityTechnologyLabel,
} from "@/lib/opportunities/catalog";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { useMemo, useState } from "react";

export function OpportunitiesPage({ overview }: { overview: OpportunityOverview }) {
  const [selected, setSelected] = useState<string[]>([]);
  const now = useMemo(() => new Date(), []);

  if (overview.kind === "no_organization") {
    return (
      <>
        <PageHeader eyebrow="Discover" title="Opportunities" subtitle="Development Intelligence" />
        <PageBody>
          <EmptyState
            title="No workspace yet"
            description="Create or join a workspace to screen development opportunities."
            action={<EmptyWorkspaceAction />}
          />
        </PageBody>
      </>
    );
  }

  if (overview.kind === "error") {
    return (
      <>
        <PageHeader eyebrow="Discover" title="Opportunities" subtitle="Development Intelligence" />
        <PageBody>
          <ErrorState
            title="Could not load opportunities"
            description="Try again in a moment. If the problem continues, sign in again."
          />
        </PageBody>
      </>
    );
  }

  const compareHref =
    selected.length >= 2
      ? `/opportunities/compare?ids=${encodeURIComponent(selected.join(","))}`
      : null;
  const empty =
    overview.funnel.total === 0 && overview.funnel.searches === 0 && overview.recentSearches.length === 0;

  return (
    <>
      <PageHeader
        eyebrow="Discover"
        title="Opportunities"
        subtitle="Identify and rank sites before they become projects. Ranking is current evidence, not project success."
        actions={
          <>
            {compareHref ? (
              <Link href={compareHref} className={buttonClassName("secondary")}>
                Compare selected
              </Link>
            ) : null}
            {overview.canWrite ? (
              <Link href="/opportunities/new" className={buttonClassName()}>
                New search
              </Link>
            ) : null}
            <BellButton />
          </>
        }
      />
      <PageBody>
        <MetricStrip className="sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Searches" value={String(overview.funnel.searches)} />
          <Metric label="Saved" value={String(overview.funnel.total)} />
          <Metric label="Shortlisted" value={String(overview.funnel.shortlisted)} />
          <Metric label="Promoted" value={String(overview.funnel.promoted)} />
          <Metric label="Rejected" value={String(overview.funnel.rejected)} />
          <Metric label="Under review" value={String(overview.funnel.underReview)} />
        </MetricStrip>

        {empty ? (
          <EmptyState
            title={EMPTY_OPPORTUNITIES_TITLE}
            description={EMPTY_OPPORTUNITIES_DESCRIPTION}
            action={
              overview.canWrite ? (
                <Link href="/opportunities/new" className={buttonClassName()}>
                  New search
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <section>
              <SectionHeader
                title="Searches / runs"
                description="Geographic screening runs. Candidate Sites live on the run results map until you save them as Opportunities."
              />
              {overview.recentSearches.length === 0 ? (
                <p className="mt-3 text-sm text-muted">No stored searches yet.</p>
              ) : (
                <div className={cn("mt-3", tableWrapClass)}>
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className={tableHeadClass}>
                      <tr>
                        <th className={tableHeadCellClass}>Search</th>
                        <th className={tableHeadCellClass}>Type</th>
                        <th className={tableHeadCellClass}>Latest run</th>
                        <th className={tableHeadCellClass}>Candidate sites</th>
                        <th className={tableHeadCellClass}>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.recentSearches.map((search) => (
                        <SearchRow key={search.id} search={search} now={now} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <SectionHeader
                title="Saved opportunities"
                description="Sites you chose to keep, including those already promoted to a Project."
              />
              {overview.ranked.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  No saved opportunities yet. Open a search run and save a Candidate Site.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
                  {overview.ranked.map((item) => (
                    <OpportunityRow
                      key={item.id}
                      item={item}
                      now={now}
                      selected={selected.includes(item.id)}
                      onToggle={() =>
                        setSelected((current) =>
                          current.includes(item.id)
                            ? current.filter((id) => id !== item.id)
                            : current.length >= 4
                              ? current
                              : [...current, item.id],
                        )
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {overview.recentRejected.length > 0 ? (
          <section>
            <SectionHeader
              title="Recently rejected"
              description="Kept for organisational memory. Not deleted."
            />
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
              {overview.recentRejected.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <Link href={`/opportunities/${item.slug}`} className="font-medium text-ink hover:underline">
                    {item.name}
                  </Link>
                  <span className="text-xs text-muted">{opportunityStatusLabel(item.status)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </PageBody>
    </>
  );
}

function SearchRow({ search, now }: { search: OpportunitySearchListItem; now: Date }) {
  const href =
    search.latestRunId
      ? `/opportunities/searches/${search.id}/runs/${search.latestRunId}`
      : "/opportunities/new";
  return (
    <tr className="border-b border-line last:border-0 hover:bg-canvas">
      <td className={tableCellClass}>
        <Link href={href} className="font-medium text-ink hover:underline">
          {search.name}
        </Link>
      </td>
      <td className={cn(tableCellClass, "text-muted")}>
        {opportunityTechnologyLabel(search.technology)}
      </td>
      <td className={cn(tableCellClass, "text-muted")}>{search.latestRunStatus ?? "No run yet"}</td>
      <td className={cn(tableCellClass, "tabular-nums")}>
        {search.returnedCount == null ? "—" : search.returnedCount}
      </td>
      <td className={cn(tableCellClass, "text-muted")}>{formatRelative(search.createdAt, now)}</td>
    </tr>
  );
}

function OpportunityRow({
  item,
  now,
  selected,
  onToggle,
}: {
  item: OpportunityListItem;
  now: Date;
  selected: boolean;
  onToggle: () => void;
}) {
  const location = [item.municipality, item.region, item.country].filter(Boolean).join(", ");
  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3">
      <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1 accent-teal" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/opportunities/${item.slug}`} className="font-medium text-ink hover:underline">
            {item.name}
          </Link>
          <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] text-muted">
            {opportunityStatusLabel(item.status)}
          </span>
          {item.promotedProjectSlug ? (
            <span className="rounded-full bg-teal-soft px-2 py-0.5 text-[11px] text-teal">Project</span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted">
          {opportunityTechnologyLabel(item.technology)}
          {location ? ` · ${location}` : ""}
          {item.targetMw != null ? ` · ${item.targetMw} MW (customer-entered)` : ""}
          {item.contiguousAreaHa != null ? ` · ${item.contiguousAreaHa.toFixed(1)} ha` : ""}
        </p>
        <p className="mt-1 text-sm">{opportunityRecommendationLabel(item.recommendation)}</p>
        <p className="mt-1 text-xs text-muted">
          {item.keyPositive ? `Signal: ${item.keyPositive}` : "No stored positive signal yet."}
          {" · "}
          {item.keyRisk ? `Risk: ${item.keyRisk}` : "No stored risk yet."}
        </p>
        <p className="mt-1 text-xs text-muted">
          Recommendation confidence: {opportunityConfidenceLabel(item.dataConfidence)}
          {item.ownerName ? ` · ${item.ownerName}` : ""} · Updated {formatRelative(item.lastUpdated, now)}
        </p>
      </div>
      <Link href={`/opportunities/${item.slug}`} className={buttonClassName("secondary")}>
        Open
      </Link>
    </li>
  );
}
