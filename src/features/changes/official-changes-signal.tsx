import Link from "next/link";
import type { OfficialChangeImpactCounts } from "@/lib/data/grid-changes-types";

export function OfficialChangesSignal({
  counts,
  href,
  sourceDelayed = false,
}: {
  counts: OfficialChangeImpactCounts;
  href: string;
  sourceDelayed?: boolean;
}) {
  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Official changes</h2>
          <p className="mt-1 text-sm text-muted">
            Geographic match for team review — not a technical impact verdict.
          </p>
        </div>
        <Link href={href} className="text-sm font-medium text-teal hover:underline">
          Open Changes
        </Link>
      </div>
      {counts.unreviewed > 0 ? (
        <p className="mt-3 text-sm">
          {counts.unreviewed} to review
          {counts.unreviewedProjectCount > 0
            ? ` · ${counts.unreviewedProjectCount} project${counts.unreviewedProjectCount === 1 ? "" : "s"} with a geographic match`
            : ""}
        </p>
      ) : sourceDelayed ? (
        <p className="mt-3 text-sm text-muted">
          Nothing waiting for review. Source update currently delayed.
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted">Nothing waiting for review</p>
      )}
      {sourceDelayed && counts.unreviewed > 0 ? (
        <p className="mt-2 text-sm text-warning">Source update currently delayed</p>
      ) : null}
    </section>
  );
}
