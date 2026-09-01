import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

export function WhySection() {
  return (
    <MarketingSection id="why">
      <Reveal>
        <Eyebrow>Why Noxheim</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
          Built for the developer&apos;s portfolio — not one network operator&apos;s map.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted">
          Your development portfolio does not stop at one network boundary. Noxheim is organised
          around the developer&apos;s projects — across operators, not inside a single operator map.
        </p>
      </Reveal>

      <Reveal delay={80}>
        <div className="mt-12 grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <article className="rounded-md border border-line bg-surface px-5 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Your portfolio
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>Vattenfall</li>
              <li>Ellevio</li>
              <li>E.ON</li>
              <li className="text-muted">other networks</li>
            </ul>
          </article>
          <div className="text-center text-sm text-muted">
            <p>all projects</p>
            <p className="mt-1 text-lg leading-none" aria-hidden>
              ↓
            </p>
          </div>
          <article className="rounded-md bg-ink px-5 py-8 text-white">
            <p className="text-[11px] tracking-[0.18em]">NOXHEIM</p>
            <p className="mt-3 text-lg font-semibold tracking-tight">
              One development workspace
            </p>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Screen, manage and monitor across the portfolio.
            </p>
          </article>
        </div>
        <p className="mt-4 text-[12px] text-muted">
          Conceptual positioning. This is not a claim of operator integrations.
        </p>
      </Reveal>
    </MarketingSection>
  );
}
