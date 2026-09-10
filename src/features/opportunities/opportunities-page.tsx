"use client";

import { BellButton } from "@/components/layout/app-shell";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState, EmptyWorkspaceAction } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DevelopmentFunnel } from "@/features/opportunities/development-funnel";
import type { OpportunityListItem, OpportunityOverview } from "@/lib/data/opportunities";
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
import Link from "next/link";
import { useMemo, useState } from "react";

export function OpportunitiesPage({ overview }: { overview: OpportunityOverview }) {
  const [selected, setSelected] = useState<string[]>([]);
  const now = useMemo(() => new Date(), []);

  if (overview.kind === "no_organization") {
    return (
      <>
        <PageHeader title="Opportunities" subtitle="Development Intelligence" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="No workspace yet"
            description="Create or join a workspace to screen development opportunities."
            action={<EmptyWorkspaceAction />}
          />
        </div>
      </>
    );
  }

  if (overview.kind === "error") {
    return (
      <>
        <PageHeader title="Opportunities" subtitle="Development Intelligence" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState title="Could not load opportunities" description="Try again in a moment." />
        </div>
      </>
    );
  }

  const compareHref =
    selected.length >= 2
      ? `/opportunities/compare?ids=${encodeURIComponent(selected.join(","))}`
      : null;

  return (
    <>
      <PageHeader
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
                New opportunity search
              </Link>
            ) : null}
            <BellButton />
          </>
        }
      />
      <div className="space-y-8 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
          <Fact label="Total" value={String(overview.funnel.total)} />
          <Fact label="Strong candidates" value={String(overview.funnel.strongCandidates)} />
          <Fact label="Under review" value={String(overview.funnel.underReview)} />
          <Fact label="Shortlisted" value={String(overview.funnel.shortlisted)} />
          <Fact label="Rejected" value={String(overview.funnel.rejected)} />
          <Fact label="Promoted" value={String(overview.funnel.promoted)} />
        </section>

        <DevelopmentFunnel funnel={overview.funnel} />

        {overview.ranked.length === 0 ? (
          overview.funnel.total === 0 ? (
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
          ) : null
        ) : (
          <section>
            <h2 className="text-base font-semibold">Ranked for investigation</h2>
            <p className="mt-1 text-sm text-muted">
              Order reflects configured criteria and currently available evidence. Connection
              availability remains unconfirmed.
            </p>
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
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
          </section>
        )}

        {overview.recentRejected.length > 0 ? (
          <section>
            <h2 className="text-base font-semibold">Recently rejected</h2>
            <p className="mt-1 text-sm text-muted">Kept for organisational memory. Not deleted.</p>
            <ul className="mt-3 space-y-1 text-sm">
              {overview.recentRejected.map((item) => (
                <li key={item.id}>
                  <Link href={`/opportunities/${item.slug}`} className="text-teal hover:underline">
                    {item.name}
                  </Link>
                  <span className="text-muted"> · {opportunityStatusLabel(item.status)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
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
    <li className="flex flex-wrap items-start gap-4 px-5 py-4">
      <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1 accent-teal" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/opportunities/${item.slug}`} className="font-medium text-ink hover:underline">
            {item.name}
          </Link>
          <span className="text-xs text-muted">{opportunityStatusLabel(item.status)}</span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {opportunityTechnologyLabel(item.technology)}
          {location ? ` · ${location}` : ""}
          {item.targetMw != null ? ` · ${item.targetMw} MW` : ""}
        </p>
        <p className="mt-2 text-sm">{opportunityRecommendationLabel(item.recommendation)}</p>
        <p className="mt-1 text-xs text-muted">
          {item.keyPositive ? `Signal: ${item.keyPositive}` : "No stored positive signal yet."}
        </p>
        <p className="mt-1 text-xs text-muted">
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
