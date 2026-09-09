"use client";

import { EmptyState, EmptyProjectsAction } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
import { attentionBandLabel } from "@/lib/intelligence";
import type { PortfolioAttentionItem, PortfolioAttentionResult } from "@/lib/intelligence/types";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const MAX_ATTENTION_ROWS = 5;

export function PortfolioAttentionSection({
  attention,
  activeCount,
  officialChangesToReview,
  sourceDelayed,
}: {
  attention: PortfolioAttentionResult;
  activeCount: number;
  officialChangesToReview: number;
  sourceDelayed: boolean;
}) {
  const nowItems = attention.prioritized
    .filter((item) => item.band === "action" || item.band === "attention")
    .slice(0, MAX_ATTENTION_ROWS);
  const hasImmediate =
    nowItems.length > 0 || attention.actionRequiredCount > 0 || officialChangesToReview > 0;

  return (
    <section id="portfolio-attention" aria-labelledby="portfolio-attention-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="portfolio-attention-heading" className="text-lg font-semibold tracking-tight">
            Do next
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Recorded workflow items and official matches waiting for your team. Not a feasibility
            score.
          </p>
        </div>
        {activeCount > 0 ? (
          <Link href="/portfolio?attention=needs_attention" className="text-sm font-medium text-teal hover:underline">
            View all in Portfolio
          </Link>
        ) : null}
      </div>

      {activeCount === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="No projects yet"
            description="Add or import a project to see what needs action."
            action={<EmptyProjectsAction />}
          />
        </div>
      ) : !hasImmediate ? (
        <div className="mt-5 rounded-md border border-line bg-surface px-5 py-8">
          <p className="text-sm font-medium text-ink">Nothing needs action right now.</p>
          <p className="mt-1 max-w-xl text-sm text-muted">
            {sourceDelayed
              ? "No overdue workflow items or unreviewed official changes. Official source update is delayed, so this is not a confirmation that published sources are current."
              : "No overdue workflow items or unreviewed official changes across the active portfolio."}
          </p>
        </div>
      ) : (
        <ul className="mt-5 divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
          {nowItems.map((item) => (
            <AttentionRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AttentionRow({ item }: { item: PortfolioAttentionItem }) {
  const topSignals = item.signals.filter((signal) => signal.severity !== "review").slice(0, 2);

  return (
    <li className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-ink">{item.name}</p>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              item.band === "action" ? "bg-critical-bg text-critical" : "bg-warning-bg text-warning",
            )}
          >
            {attentionBandLabel(item.band)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {item.stage}
          {item.daysInCurrentStage == null ? "" : ` · ${item.daysInCurrentStage} days in stage`}
        </p>
        <ul className="mt-2 space-y-1">
          {topSignals.map((signal) => (
            <li key={signal.type} className="text-sm text-muted">
              <span className="font-medium text-ink">{signal.title}</span>
              {signal.detail ? ` · ${signal.detail}` : ""}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm">
          <span className="text-muted">Next: </span>
          <span className="font-medium text-ink">{item.nextAction.title}</span>
        </p>
      </div>
      <Link
        href={`/projects/${item.slug}`}
        className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-teal hover:underline"
      >
        Open <ArrowRight size={14} />
      </Link>
    </li>
  );
}
