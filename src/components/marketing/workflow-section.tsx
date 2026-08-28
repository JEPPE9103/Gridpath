import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

const STEPS = [
  {
    n: "01",
    title: "Screen",
    lead: "Add your development projects",
    copy: "Give Noxheim the project location, MW and basic development context.",
  },
  {
    n: "02",
    title: "Manage",
    lead: "Run the development process",
    copy: "Track connection progress, requirements, project status and team judgement.",
  },
  {
    n: "03",
    title: "Monitor",
    lead: "Connect external changes back to the portfolio",
    copy: "Review relevant published information and understand which projects may require attention.",
  },
];

export function WorkflowSection() {
  return (
    <MarketingSection id="how-it-works" className="bg-surface">
      <Reveal>
        <Eyebrow>How it works</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
          Project, intelligence, workflow, change.
        </h2>
      </Reveal>
      <div className="mt-12 grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <Reveal key={step.n} delay={index * 50} className="h-full">
            <article className="h-full bg-surface px-5 py-6">
              <p className="font-mono text-xs text-teal">{step.n}</p>
              <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
              <p className="mt-3 text-sm font-medium">{step.lead}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{step.copy}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </MarketingSection>
  );
}
