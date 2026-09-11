import type { OpportunityFunnel } from "@/lib/data/opportunities";

export function DevelopmentFunnel({ funnel }: { funnel: OpportunityFunnel }) {
  const pipeline = [
    { label: "Screening searches", value: funnel.searches },
    { label: "Opportunities", value: funnel.total },
    { label: "Strong candidates", value: funnel.strongCandidates },
    { label: "Shortlisted", value: funnel.shortlisted },
    { label: "Promoted projects", value: funnel.promoted },
  ];
  const hasData = pipeline.some((step) => step.value > 0) || funnel.rejected > 0;
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
        Stored workflow sequence only. Not available capacity or connection probability.
      </p>
      <div className="mt-3 flex overflow-x-auto rounded-md border border-line bg-surface">
        {pipeline.map((step, index) => (
          <div
            key={step.label}
            className="min-w-[8rem] flex-1 border-r border-line px-3 py-2.5 last:border-r-0"
          >
            <p className="text-[10px] tabular-nums text-muted">{index + 1}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">{step.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{step.value}</p>
          </div>
        ))}
        <div className="min-w-[7.5rem] border-l border-line bg-canvas px-3 py-2.5">
          <p className="text-[10px] text-muted">Out</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">Rejected</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-muted">{funnel.rejected}</p>
        </div>
      </div>
    </section>
  );
}
