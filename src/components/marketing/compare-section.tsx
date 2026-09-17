import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { SAMPLE_CANDIDATE_SITES } from "@/lib/demo/sample-discovery-preview";

const CANDIDATE_ACTIONS = ["Compare", "Save as opportunity"] as const;
const OPPORTUNITY_ACTIONS = ["Shortlist", "Reject", "Reopen", "Promote to project"] as const;

export function CompareSection() {
  return (
    <MarketingSection className="bg-surface">
      <Reveal>
        <Eyebrow>Compare / decide</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
          Put Candidate Sites side by side before you commit diligence budget.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Same evidence language as the product: coverage, covering geography, unknowns, and
          recommended next — so the shortlist debate stays grounded. Save a Candidate Site as an
          Opportunity; shortlist, reject, reopen or promote happen there.
        </p>
      </Reveal>

      <Reveal delay={70} fade>
        <div className="mt-10 overflow-hidden rounded-lg border border-line bg-canvas">
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
                Sample comparison of three Candidate Sites on stored Evidence Coverage and Candidate
                Intelligence. Investigation priority is Noxheim derived, not a success score.
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
                  label="Network covering"
                  values={SAMPLE_CANDIDATE_SITES.map(() => "Official covering, not capacity")}
                />
                <CompareRow
                  label="Evidence coverage"
                  values={SAMPLE_CANDIDATE_SITES.map((site) => site.evidenceSummary)}
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

      <Reveal delay={90}>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <ActionCard title="On a Candidate Site" actions={CANDIDATE_ACTIONS} />
          <ActionCard title="On an Opportunity" actions={OPPORTUNITY_ACTIONS} />
        </div>
      </Reveal>
    </MarketingSection>
  );
}

function CompareRow({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <tr className="border-b border-line last:border-b-0">
      <th className="px-4 py-3 text-left text-[12px] font-medium text-muted">{label}</th>
      {values.map((value, index) => (
        <td key={`${label}-${index}`} className="px-4 py-3 text-[13px] leading-5 text-ink">
          {value}
        </td>
      ))}
    </tr>
  );
}

function ActionCard({ title, actions }: { title: string; actions: readonly string[] }) {
  return (
    <div className="rounded-md border border-line bg-canvas px-4 py-4">
      <p className="text-[11px] uppercase tracking-wide text-muted">{title}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {actions.map((action) => (
          <li
            key={action}
            className="rounded-md border border-line bg-surface px-2.5 py-1 text-[12px] font-medium"
          >
            {action}
          </li>
        ))}
      </ul>
    </div>
  );
}
