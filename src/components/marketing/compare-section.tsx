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
          Compare Candidate Sites on the same evidence. Then decide what to keep.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          See differences in Evidence Coverage, covering geography and remaining uncertainty.
          Save a Candidate Site as an Opportunity. Shortlist, reject, reopen or promote happen on
          that Opportunity — not on the screening result.
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
                Sample comparison of three Candidate Sites on stored Evidence Coverage. Investigation
                priority is Noxheim derived, not a success score.
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
                  label="Main uncertainty"
                  values={SAMPLE_CANDIDATE_SITES.map((site) => site.keyRisk)}
                />
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-4 py-3 text-[11px] leading-5 text-muted">
            Investigation priority from stored evidence. Not a success score.
          </p>
        </div>
      </Reveal>

      <Reveal delay={90}>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <ActionGroup
            stage="Candidate Site"
            copy="On the screening result."
            actions={CANDIDATE_ACTIONS}
          />
          <ActionGroup
            stage="Opportunity"
            copy="After you keep a site."
            actions={OPPORTUNITY_ACTIONS}
          />
        </div>
      </Reveal>
    </MarketingSection>
  );
}

function ActionGroup({
  stage,
  copy,
  actions,
}: {
  stage: string;
  copy: string;
  actions: readonly string[];
}) {
  return (
    <article className="rounded-lg border border-line bg-canvas px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{stage}</p>
      <p className="mt-1 text-[11px] leading-4 text-muted">{copy}</p>
      <ul className="mt-2.5 flex flex-wrap gap-1.5">
        {actions.map((action) => (
          <li
            key={action}
            className="rounded-md border border-line bg-surface px-2.5 py-1 text-[12px] font-medium"
          >
            {action}
          </li>
        ))}
      </ul>
    </article>
  );
}

function CompareRow({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <tr className="border-b border-line last:border-b-0">
      <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted">{label}</th>
      {values.map((value, index) => (
        <td
          key={`${label}-${index}`}
          className={index === 0 ? "px-4 py-2.5 text-[13px] leading-5 font-medium" : "px-4 py-2.5 text-[13px] leading-5"}
        >
          {value}
        </td>
      ))}
    </tr>
  );
}
