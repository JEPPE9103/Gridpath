import { CtaLink } from "@/components/marketing/cta-link";
import { Reveal } from "@/components/marketing/reveal";
import { MarketingSection } from "@/components/marketing/section";

export function FinalCtaSection() {
  return (
    <MarketingSection className="bg-surface">
      <Reveal>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-[42px] sm:leading-[1.12]">
          Find sites worth investigating. Stop weak ones earlier. Keep the evidence behind every
          decision.
        </h2>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted">
          Development Intelligence for Swedish BESS and renewable teams — from Search Area through
          Candidate Site, Opportunity, Project, connection process tracking and official-source
          monitoring.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <CtaLink href="/#demo" className="w-full px-5 sm:w-auto">
            Book a demo
          </CtaLink>
          <CtaLink href="/#design-partner" variant="secondary" className="w-full px-5 sm:w-auto">
            Become a design partner
          </CtaLink>
        </div>
      </Reveal>
    </MarketingSection>
  );
}
