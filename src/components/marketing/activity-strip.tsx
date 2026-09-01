const ITEMS = [
  {
    kind: "PROJECT ADDED",
    detail: "Stockholm North BESS · 40 MW",
  },
  {
    kind: "GRID CONTEXT MATCHED",
    detail: "Official local-network area identified",
  },
  {
    kind: "CONNECTION UPDATED",
    detail: "Application → Grid Study",
  },
  {
    kind: "REQUIREMENT COMPLETED",
    detail: "Readiness 50% → 75%",
  },
  {
    kind: "SOURCE CHECKED",
    detail: "No portfolio-impacting changes",
  },
  {
    kind: "NUP CONTEXT AVAILABLE",
    detail: "Official source",
  },
];

export function ActivityStrip() {
  const loop = [...ITEMS, ...ITEMS];

  return (
    <section
      aria-label="Sample workspace activity"
      className="border-b border-line bg-surface"
    >
      <p className="sr-only">
        Sample workspace activity: project added, grid context matched, connection updated,
        requirement completed, source checked, and NUP context available.
      </p>
      <div className="mx-auto flex max-w-[1200px] items-center gap-5 px-5 py-3 sm:px-8 md:px-10">
        <p className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted sm:block">
          Sample workspace activity
        </p>
        <div className="marketing-marquee min-w-0 flex-1 overflow-hidden" aria-hidden>
          <div className="marketing-marquee-track flex w-max gap-3">
            {loop.map((item, index) => (
              <article
                key={`${item.kind}-${index}`}
                className="flex shrink-0 items-center gap-3 rounded-md border border-line bg-canvas px-3 py-2"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal">
                  {item.kind}
                </p>
                <p className="text-[12px] text-ink">{item.detail}</p>
                <span className="text-[10px] uppercase tracking-wide text-muted">Sample</span>
              </article>
            ))}
          </div>
        </div>
      </div>
      <p className="px-5 pb-3 text-[10px] uppercase tracking-wide text-muted sm:hidden">
        Sample workspace activity
      </p>
    </section>
  );
}
