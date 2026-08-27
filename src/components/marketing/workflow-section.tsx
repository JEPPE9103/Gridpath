import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

const STEPS = [
  {
    n: "01",
    title: "Place a site",
    copy: "Add the project coordinate, technology and requested import/export to the portfolio.",
  },
  {
    n: "02",
    title: "Read official context",
    copy: "See Ei local-network and NUP planning-area coverage, with source and retrieved time.",
  },
  {
    n: "03",
    title: "Track the connection",
    copy: "Keep the operator case, requirements, documents and deadlines on the same record.",
  },
  {
    n: "04",
    title: "Review published changes",
    copy: "When a dataset version changes, inspect before/after and which sites sit in that area.",
  },
];

export function WorkflowSection() {
  return (
    <MarketingSection id="how-it-works">
      <Reveal>
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
          From a coordinate to official grid context.
        </h2>
      </Reveal>
      <div className="mt-12 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
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
