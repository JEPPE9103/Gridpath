import { CtaLink } from "@/components/marketing/cta-link";
import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

export function DesignPartnerSection() {
  return (
    <MarketingSection id="design-partner" className="bg-surface">
      <Reveal>
        <Eyebrow>Design partner</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
          Help shape the development intelligence layer you actually need.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted">
          We are working with a small number of Swedish BESS and renewable development teams to
          validate Noxheim against real portfolios and real grid-connection workflows.
        </p>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Design partners get direct onboarding, close support and the opportunity to influence
          which intelligence layers Noxheim develops next.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <CtaLink href="/#demo" className="w-full px-5 sm:w-auto">
            Become a design partner
          </CtaLink>
          <CtaLink href="/#demo" variant="secondary" className="w-full px-5 sm:w-auto">
            Book a demo
          </CtaLink>
        </div>
      </Reveal>
    </MarketingSection>
  );
}
