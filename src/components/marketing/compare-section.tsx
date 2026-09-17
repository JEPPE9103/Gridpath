import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { SAMPLE_CANDIDATE_SITES } from "@/lib/demo/sample-discovery-preview";

/**
 * Compare — decision-relevant fields only. No mini maps.
 */
export function CompareSection() {
  return (
    <MarketingSection id="compare">
      <Reveal>
        <div className="max-w-xl">
          <Eyebrow>Compare</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
            Compare sites on what actually matters.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Compare evidence, constraints and unknowns side by side — and understand why one option
            progresses while another does not.
          </p>
        </div>
      </Reveal>

      <Reveal delay={50} fade>
        <div className="mt-10 overflow-hidden rounded-lg border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted">
              Compare selected sites
            </p>
            <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
              Sample
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">
                Sample comparison of three Candidate Sites on investigation priority, constraints,
                unknowns and recommended next. Not a success score. Unknown ≠ pass.
              </caption>
              <thead>
                <tr className="border-b border-line bg-canvas text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-3 font-medium">Field</th>
                  {SAMPLE_CANDIDATE_SITES.map((site) => (
                    <th key={site.id} className="px-4 py-3 font-medium text-ink">
                      {site.name.replace("Candidate ", "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <CompareRow
                  label="Investigation priority"
                  values={SAMPLE_CANDIDATE_SITES.map((site) => site.recommendation)}
                />
                <CompareRow
                  label="Top constraint"
                  values={SAMPLE_CANDIDATE_SITES.map((site) => site.topConstraint)}
                />
                <CompareRow
                  label="Top unknown"
                  values={SAMPLE_CANDIDATE_SITES.map((site) => site.topUnknown)}
                />
                <CompareRow
                  label="Recommended next"
                  values={SAMPLE_CANDIDATE_SITES.map((site) => site.recommendedNext)}
                />
              </tbody>
            </table>
          </div>

          <p className="border-t border-line px-4 py-3 text-[11px] leading-5 text-muted">
            Investigation priority from stored evidence. Not a success score. Unknown ≠ pass.
          </p>
        </div>
      </Reveal>
    </MarketingSection>
  );
}

function CompareRow({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <tr className="border-b border-line last:border-b-0">
      <th className="px-4 py-3.5 align-top text-left text-[12px] font-medium text-muted">{label}</th>
      {values.map((value, index) => (
        <td key={`${label}-${index}`} className="px-4 py-3.5 text-[13px] leading-5 text-ink">
          {value}
        </td>
      ))}
    </tr>
  );
}
