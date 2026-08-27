import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

const ITEMS = [
  {
    title: "Official context first",
    copy: "See Ei local-network and NUP coverage before spending detailed engineering time.",
  },
  {
    title: "Process in one record",
    copy: "Keep the operator case, documents and deadlines beside the grid context.",
  },
  {
    title: "Published changes, not invented impact",
    copy: "Inspect what a source published, then which sites sit in that planning area.",
  },
  {
    title: "Compare the portfolio",
    copy: "Look across sites without treating forecast MW as available capacity.",
  },
];

export function WhySection() {
  return (
    <MarketingSection id="why">
      <Reveal>
        <Eyebrow>Why it matters</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
          Spend engineering time on projects that deserve it.
        </h2>
      </Reveal>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {ITEMS.map((item, index) => (
          <Reveal key={item.title} delay={index * 60}>
            <article className="h-full rounded-md border border-line bg-surface px-6 py-7">
              <h3 className="text-lg font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.copy}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </MarketingSection>
  );
}
