import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { SAMPLE_CANDIDATE_SITES } from "@/lib/demo/sample-discovery-preview";

const ACTIONS = ["Compare", "Shortlist", "Reject", "Reopen", "Save as Opportunity"];

export function CompareSection() {
  return (
    <MarketingSection className="bg-surface">
      <Reveal>
        <Eyebrow>Compare / decide</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
          Compare sites on the same evidence. Then decide what to keep.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          See differences in Evidence Coverage, covering geography and remaining uncertainty.
          Shortlist, reject, reopen, or save a Candidate Site as an Opportunity.
        </p>
      </Reveal>

      <Reveal delay={70} fade>
        <div className="mt-10 overflow-hidden rounded-md border border-line bg-canvas">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-muted">
              Compare selected Candidate Sites
            </p>
            <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
              Sample
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">
                Sample comparison of three Candidate Sites on stored Evidence Coverage.
              </caption>
              <thead>
                <tr className="border-b border-line bg-surface text-[11px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5 font-medium">Field</th>
                  {SAMPLE_CANDIDATE_SITES.map((site) => (
                    <th key={site.id} className="px-4 py-2.5 font-medium text-ink">
                      {site.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <CompareRow
                  label="Recommendation"
                  values={SAMPLE_CANDIDATE_SITES.map((site) => site.recommendation)}
                />
                <CompareRow
                  label="Contiguous ha"
                  values={SAMPLE_CANDIDATE_SITES.map((site) => site.contiguousHa)}
                />
                <CompareRow
                  label="Network area"
                  values={SAMPLE_CANDIDATE_SITES.map(() => "Ei covering")}
                />
                <CompareRow
                  label="Evidence"
                  values={SAMPLE_CANDIDATE_SITES.map((site) => site.evidenceSummary)}
                />
                <CompareRow
                  label="Main uncertainty"
                  values={SAMPLE_CANDIDATE_SITES.map((site) => site.keyRisk)}
                />
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-4 py-3 text-[11px] leading-5 text-muted">
            Investigation priority from stored evidence.
          </p>
        </div>
      </Reveal>

      <Reveal delay={90}>
        <ul className="mt-6 flex flex-wrap gap-2">
          {ACTIONS.map((action) => (
            <li
              key={action}
              className="rounded-md border border-line bg-surface px-3 py-1.5 text-[12px] font-medium"
            >
              {action}
            </li>
          ))}
        </ul>
      </Reveal>
    </MarketingSection>
  );
}

function CompareRow({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <tr className="border-b border-line last:border-b-0">
      <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted">{label}</th>
      {values.map((value, index) => (
        <td key={`${label}-${index}`} className="px-4 py-2.5 text-[13px] leading-5">
          {value}
        </td>
      ))}
    </tr>
  );
}
