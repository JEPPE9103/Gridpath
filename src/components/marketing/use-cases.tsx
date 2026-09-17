import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

const CURRENT = {
  title: "Energy & storage",
  body: "Early geographic screening for energy development.",
} as const;

const EXPANDING = [
  {
    title: "Industrial development",
    body: "Early land assessment with the same evidence and comparison workflow.",
  },
  {
    title: "Logistics",
    body: "Location screening before deeper site diligence.",
  },
  {
    title: "Data centres",
    body: "Pre-feasibility with official evidence, constraints and unknowns.",
  },
  {
    title: "Municipal development",
    body: "Earlier understanding of development land and alternatives.",
  },
] as const;

/**
 * Use cases — one platform; current workflow vs expanding with design partners.
 */
export function UseCases() {
  return (
    <MarketingSection id="use-cases" className="bg-surface">
      <Reveal>
        <Eyebrow>Use cases</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
          One intelligence layer.
          <br />
          Whatever you plan to build.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Start with what you want to develop. Noxheim brings together location evidence,
          constraints and unknowns to help you understand where to assess next.
        </p>
      </Reveal>

      <Reveal delay={40}>
        <div className="mt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal">
            Current workflow
          </p>
          <article className="mt-3 max-w-xl rounded-lg border border-teal/25 bg-teal-soft/40 px-5 py-5">
            <h3 className="text-base font-semibold text-ink">{CURRENT.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted">{CURRENT.body}</p>
          </article>
        </div>
      </Reveal>

      <Reveal delay={70}>
        <div className="mt-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Expanding with design partners
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {EXPANDING.map((item) => (
              <li key={item.title} className="rounded-lg border border-line bg-canvas px-4 py-4">
                <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </MarketingSection>
  );
}
