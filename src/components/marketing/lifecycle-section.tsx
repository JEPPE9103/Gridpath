import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

const STAGES = [
  {
    title: "Candidate Site",
    copy: "A bounded investigation target from geographic screening, with Evidence Coverage and Candidate Intelligence attached.",
  },
  {
    title: "Opportunity",
    copy: "A Candidate Site your team chose to keep — freeze the decision trail. Shortlist, reject, reopen, or promote without losing the screening record.",
  },
  {
    title: "Project",
    copy: "Promote when the site is worth developing. Origin, Evidence Coverage and covering geography follow into the project record.",
  },
] as const;

export function LifecycleSection() {
  return (
    <MarketingSection id="develop">
      <Reveal>
        <Eyebrow>Opportunity</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
          From search to a frozen decision trail.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Discover, decide, freeze. Evidence and origin stay attached when a Candidate Site becomes
          an Opportunity and then a Project — so the next person inherits the trail, not a
          spreadsheet of opinions.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        {STAGES.map((stage, index) => (
          <Reveal key={stage.title} delay={index * 50} className="h-full">
            <article className="h-full bg-surface px-5 py-6">
              <p className="font-mono text-xs text-teal">{String(index + 1).padStart(2, "0")}</p>
              <h3 className="mt-3 text-lg font-semibold">{stage.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{stage.copy}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </MarketingSection>
  );
}
