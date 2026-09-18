import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

/**
 * Problem — one idea: investigation capital often commits before risks and unknowns are clear.
 */
export function ValueSection() {
  return (
    <MarketingSection id="why" className="bg-surface !py-10 sm:!py-14 lg:!py-16">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>The problem</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
            Important risks and unknowns often surface too late.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted">
            Development teams frequently commit time and capital before the evidence is assembled.
            Critical information is fragmented across portals, maps and reports — and early
            assessment may happen in the wrong order. Noxheim moves that understanding earlier.
          </p>
        </div>
      </Reveal>
    </MarketingSection>
  );
}
