import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

const STEPS = [
  {
    n: "01",
    title: "Screen",
    copy: "Place a site against public grid signals, constraints and internal hypotheses.",
  },
  {
    n: "02",
    title: "Prioritise",
    copy: "Compare outlook, confidence and readiness before further engineering spend.",
  },
  {
    n: "03",
    title: "Apply",
    copy: "Assemble the enquiry or application pack against operator requirements.",
  },
  {
    n: "04",
    title: "Track",
    copy: "Follow studies, offers, documents and deadlines across operators.",
  },
  {
    n: "05",
    title: "Monitor",
    copy: "See which published grid changes land on which projects.",
  },
];

export function WorkflowSection() {
  return (
    <MarketingSection id="how-it-works">
      <Reveal>
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
          From site idea to connection agreement.
        </h2>
      </Reveal>
      <div className="mt-12 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((step, index) => (
          <Reveal key={step.n} delay={index * 50} className="h-full">
            <article className="h-full bg-surface px-5 py-6">
              <p className="font-mono text-xs text-teal">{step.n}</p>
              <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{step.copy}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </MarketingSection>
  );
}
