"use client";

import { EmptyState } from "@/components/ui/empty-state";
import type { PortfolioAttentionResult } from "@/lib/intelligence/types";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function PortfolioAttentionSection({
  attention,
}: {
  attention: PortfolioAttentionResult;
}) {
  const total = attention.needsAttention.length + attention.watch.length;

  return (
    <section
      id="portfolio-attention"
      className="rounded-md border border-line bg-surface"
      aria-labelledby="portfolio-attention-heading"
    >
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h2 id="portfolio-attention-heading" className="text-base font-semibold">
          Portfolio Attention
        </h2>
        {total > 0 ? (
          <p className="mt-1 text-sm text-muted">
            {attention.needsAttention.length > 0
              ? `${attention.needsAttention.length} project${attention.needsAttention.length === 1 ? "" : "s"} need attention`
              : "Projects to watch in your workflow"}
            {attention.watch.length > 0 && attention.needsAttention.length > 0
              ? ` · ${attention.watch.length} to watch`
              : null}
          </p>
        ) : null}
      </div>

      {total === 0 ? (
        <div className="p-5">
          <EmptyState
            title="No current workflow issues require attention"
            description="NOXHEIM will surface connection, requirement and relevant monitoring items here when they require review."
          />
        </div>
      ) : (
        <div className="divide-y divide-line">
          {attention.needsAttention.length > 0 ? (
            <AttentionGroup title="Needs attention" items={attention.needsAttention} />
          ) : null}
          {attention.watch.length > 0 ? (
            <AttentionGroup title="Watch" items={attention.watch} />
          ) : null}
        </div>
      )}
    </section>
  );
}

function AttentionGroup({
  title,
  items,
}: {
  title: string;
  items: PortfolioAttentionResult["needsAttention"];
}) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-line bg-canvas px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-ink">{item.name}</p>
              <p className="mt-1 text-sm text-muted">{item.summary}</p>
            </div>
            <Link
              href={`/projects/${item.slug}`}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-teal hover:underline"
            >
              View project <ArrowRight size={14} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
