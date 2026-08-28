import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

const ITEMS = [
  {
    title: "Across operators",
    copy: "Your development portfolio does not stop at one network boundary. Noxheim is designed around the developer's projects.",
  },
  {
    title: "Context + workflow",
    copy: "Official information becomes more useful when it sits beside the connection process and development decisions it affects.",
  },
  {
    title: "Traceable intelligence",
    copy: "Source, retrieval date and provenance stay attached to the information Noxheim presents.",
  },
  {
    title: "Portfolio-first",
    copy: "Noxheim is built to show what published information means for your projects — not simply display another dataset.",
  },
];

export function WhySection() {
  return (
    <MarketingSection id="why">
      <Reveal>
        <Eyebrow>Why Noxheim</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
          Built for the developer&apos;s portfolio — not one network operator&apos;s map.
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
