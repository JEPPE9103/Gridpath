"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/cn";
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
  const hasImmediate = nowItems.length > 0 || attention.actionRequiredCount > 0 || officialChangesToReview > 0;

  return (
    <section
      id="portfolio-attention"
      className="rounded-md border border-line bg-surface"
      aria-labelledby="portfolio-attention-heading"
    >
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h2 id="portfolio-attention-heading" className="text-base font-semibold">
          Portfolio attention
        </h2>
        <p className="mt-1 text-sm text-muted">
          Which recorded workflow items need action, why, and what to do next. This is not a grid
          feasibility score.
        </p>
        {activeCount === 0 ? null : (
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <CountCell label="Active projects" value={String(activeCount)} />
            <CountCell label="Action required" value={String(attention.actionRequiredCount)} tone="action" />
            <CountCell label="Upcoming" value={String(attention.upcomingCount)} tone="attention" />
            <CountCell
              label="Official changes to review"
              value={String(officialChangesToReview)}
              tone={officialChangesToReview > 0 ? "attention" : undefined}
            />
          </dl>
        )}
      </div>

      {activeCount === 0 ? (
        <div className="p-5">
          <EmptyState
            title="No projects yet"
            description="Add or import your first project to start building portfolio intelligence."
          />
        </div>
      ) : !hasImmediate ? (
        <div className="p-5">
          <EmptyState
            title="No immediate portfolio actions"
            description={
              sourceDelayed
                ? "NOXHEIM has not identified overdue workflow items or unreviewed official changes across the active portfolio. Official source update is delayed, so this is not a confirmation that published sources are current."
                : "NOXHEIM has not identified overdue workflow items or unreviewed official changes across the active portfolio."
            }
          />
        </div>
      ) : (
        <div className="px-4 py-4 sm:px-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Needs attention now</h3>
          <ul className="mt-3 space-y-3">
            {nowItems.map((item) => (
              <AttentionRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function CountCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "action" | "attention";
}) {
  return (
    <div className="rounded-md border border-line bg-canvas px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-lg font-semibold text-ink",
          tone === "action" && value !== "0" && "text-critical",
          tone === "attention" && value !== "0" && "text-warning",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function AttentionRow({ item }: { item: PortfolioAttentionItem }) {
  const topSignals = item.signals.filter((signal) => signal.severity !== "review").slice(0, 2);

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-line bg-canvas px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-ink">{item.name}</p>
        <p className="mt-1 text-sm text-muted">
          {item.stage}
          {item.daysInCurrentStage == null ? "" : ` · ${item.daysInCurrentStage} days`}
        </p>
        <ul className="mt-2 space-y-1">
          {topSignals.map((signal) => (
            <li key={signal.type} className="flex items-start gap-2 text-sm">
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  signal.severity === "action" ? "bg-critical" : "bg-warning",
                )}
                aria-hidden="true"
              />
              <span>
                <span className="font-medium text-ink">{signal.title}</span>
                {signal.detail ? <span className="text-muted"> · {signal.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm">
          <span className="text-muted">Next action: </span>
          <span className="font-medium text-ink">{item.nextAction.title}</span>
        </p>
      </div>
      <Link
        href={`/projects/${item.slug}`}
        className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-teal hover:underline"
      >
        Open project <ArrowRight size={14} />
      </Link>
    </li>
  );
}
