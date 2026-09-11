import { AppFrame } from "@/components/marketing/app-frame";
import { DeferredDiscoveryMap } from "@/components/marketing/deferred-discovery-map";
import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

const STEPS = [
  {
    title: "Search Area",
    copy: "A bounded geography you choose to investigate.",
  },
  {
    title: "Opportunity Zones",
    copy: "Broader qualifying geography after supported exclusions — context for Candidate Sites.",
  },
  {
    title: "Candidate Sites",
    copy: "Bounded investigation targets grown from qualifying land. Rankings prioritise further investigation.",
  },
];

export function FindSitesSection() {
  return (
    <MarketingSection id="product" className="bg-surface">
      <div className="grid items-start gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
        <Reveal>
          <Eyebrow>Find</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[36px] sm:leading-[1.15]">
            Search a geography. Identify Candidate Sites worth investigating.
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            Candidate Sites are grown from qualifying land inside the Search Area. Opportunity Zones
            stay in the background as broader remaining geography.
          </p>
          <ol className="mt-6 max-w-md space-y-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="font-mono text-xs text-teal">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted">{step.copy}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
        <Reveal delay={80} fade>
          <AppFrame path="/opportunities">
            <div className="bg-canvas">
              <DeferredDiscoveryMap size="full" />
              <p className="border-t border-line px-4 py-3 text-[11px] leading-5 text-muted">
                Sample screening. Opportunity Zones recede as context. Candidate Sites are the
                investigation layer.
              </p>
            </div>
          </AppFrame>
        </Reveal>
      </div>
    </MarketingSection>
  );
}
