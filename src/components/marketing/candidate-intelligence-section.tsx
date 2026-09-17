import { DeferredDiscoveryMap } from "@/components/marketing/deferred-discovery-map";
import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { SAMPLE_CANDIDATE_SITES } from "@/lib/demo/sample-discovery-preview";

/**
 * Candidate Intelligence — one large product example.
 */
export function CandidateIntelligenceSection() {
  const featured = SAMPLE_CANDIDATE_SITES[0];

  return (
    <MarketingSection id="intelligence" className="bg-surface" wide>
      <Reveal>
        <div className="max-w-xl">
          <Eyebrow>Candidate Intelligence</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
            Know what you know.
            <br />
            See what you don&apos;t.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Known evidence, constraints, unknowns and what should happen next — for a specific
            location.
          </p>
        </div>
      </Reveal>

      <Reveal delay={50} fade>
        <div className="relative mt-10 overflow-hidden rounded-lg border border-line bg-canvas shadow-[0_28px_56px_-34px_rgba(26,30,36,0.5)]">
          <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative border-b border-line lg:border-b-0 lg:border-r">
              <DeferredDiscoveryMap size="full" variant="discovery" />
              <p className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-line/80 bg-surface/90 px-2.5 py-1 text-[11px] text-muted backdrop-blur-sm">
                <span className="font-semibold text-ink">Site A</span> selected
              </p>
            </div>

            <article className="flex flex-col bg-surface p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Candidate Intelligence
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-ink">
                    #{featured.rank} {featured.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    {featured.contiguousHa} ha · {featured.recommendation}
                  </p>
                </div>
                <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                  Sample
                </span>
              </div>

              <dl className="mt-6 space-y-3 text-sm">
                <div className="rounded-md border border-line bg-canvas px-3 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-teal">
                    Known
                  </dt>
                  <dd className="mt-1 text-[13px] leading-5 text-ink">{featured.evidenceSummary}</dd>
                </div>
                <div className="rounded-md border border-line bg-canvas px-3 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink">
                    Constraint
                  </dt>
                  <dd className="mt-1 text-[13px] leading-5 text-ink">{featured.topConstraint}</dd>
                </div>
                <div className="rounded-md border border-line bg-canvas px-3 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink">
                    Unknown
                  </dt>
                  <dd className="mt-1 font-medium leading-5 text-ink">{featured.topUnknown}</dd>
                </div>
                <div className="rounded-md border border-teal/30 bg-teal-soft/70 px-3 py-3">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-teal">
                    Recommended next
                  </dt>
                  <dd className="mt-1 font-medium leading-5 text-ink">{featured.recommendedNext}</dd>
                </div>
              </dl>

              <p className="mt-auto border-t border-line pt-4 text-xs leading-5 text-muted">
                Screening supports early assessment — not engineering feasibility.
              </p>
            </article>
          </div>
        </div>
      </Reveal>
    </MarketingSection>
  );
}
