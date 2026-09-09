import type { OpportunityFunnel } from "@/lib/data/opportunities";

export function DevelopmentFunnel({ funnel }: { funnel: OpportunityFunnel }) {
  const steps = [
    { label: "Screening searches", value: funnel.searches },
    { label: "Opportunities", value: funnel.total },
    { label: "Strong candidates", value: funnel.strongCandidates },
    { label: "Shortlisted", value: funnel.shortlisted },
    { label: "Promoted projects", value: funnel.promoted },
    { label: "Rejected", value: funnel.rejected },
  ];
  const hasData = steps.some((step) => step.value > 0);
  if (!hasData) {
    return (
      <section className="rounded-md border border-line bg-surface px-5 py-6">
        <h2 className="text-base font-semibold">Development funnel</h2>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Counts appear here from stored screening searches and opportunities. NOXHEIM does not
          invent screened-area totals.
        </p>
      </section>
    );
  }
  return (
    <section>
      <h2 className="text-base font-semibold">Development funnel</h2>
      <p className="mt-1 text-sm text-muted">
        Stored workflow counts only. Not available capacity or connection probability.
      </p>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {steps.map((step) => (
          <div
            key={step.label}
            className="min-w-[8rem] shrink-0 rounded-md border border-line bg-surface px-3 py-2.5"
          >
            <p className="text-[11px] uppercase tracking-wide text-muted">{step.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{step.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
