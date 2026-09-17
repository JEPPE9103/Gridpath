import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { SAMPLE_CANDIDATE_SITES } from "@/lib/demo/sample-discovery-preview";

/**
 * Candidate Intelligence — mirrors live product framing:
 * why this site, top constraint, top unknown, recommended next step.
 */
export function CandidateIntelligenceSection() {
  return (
    <MarketingSection id="intelligence">
      <Reveal>
        <Eyebrow>Candidate Intelligence</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
          Not a list of parcels — a ranked shortlist with reasons.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          For each Candidate Site, Noxheim surfaces why it ranks, the top constraint, the top
          unknown, and the recommended next step. Missing or silent evidence is never treated as a
          pass.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-3 lg:grid-cols-3">
        {SAMPLE_CANDIDATE_SITES.map((site, index) => (
          <Reveal key={site.id} delay={index * 50} className="h-full">
            <article
              className={`flex h-full flex-col rounded-lg border px-5 py-5 ${
                index === 0 ? "border-teal/40 bg-surface" : "border-line bg-surface"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-teal">
                    {String(site.rank).padStart(2, "0")}
                  </p>
                  <h3 className="mt-1 text-base font-semibold">{site.name}</h3>
                  <p className="mt-1 text-xs text-muted">
                    {site.contiguousHa} ha · {site.recommendation}
                  </p>
                </div>
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-teal">
                    Why this site
                  </dt>
                  <dd className="mt-1 leading-6 text-muted">{site.whyThisSite}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink">
                    Top constraint
                  </dt>
                  <dd className="mt-1 leading-6 text-muted">{site.topConstraint}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink">
                    Top unknown
                  </dt>
                  <dd className="mt-1 leading-6 text-muted">{site.topUnknown}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Recommended next
                  </dt>
                  <dd className="mt-1 font-medium leading-6 text-ink">{site.recommendedNext}</dd>
                </div>
              </dl>
            </article>
          </Reveal>
        ))}
      </div>
    </MarketingSection>
  );
}
