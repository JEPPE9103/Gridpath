import { CtaLink } from "@/components/marketing/cta-link";
import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";

export function DesignPartnerSection() {
  return (
    <MarketingSection id="design-partner">
      <Reveal>
        <div className="rounded-md border border-line bg-surface px-6 py-10 sm:px-10 sm:py-12 lg:px-14">
          <Eyebrow>Design partner</Eyebrow>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.15]">
            Help shape Development Intelligence against real Swedish sites.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted">
            We are working with a small number of Swedish BESS and renewable development teams to
            validate Noxheim on real geographies, real evidence gaps and real connection workflows.
          </p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
            Design partners get a guided workspace, close support, and a say in which evidence layers
            Noxheim develops next. This is not instant national self-service.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <CtaLink href="/#demo" className="w-full px-5 sm:w-auto">
              Book a demo
            </CtaLink>
            <CtaLink href="/#demo" variant="secondary" className="w-full px-5 sm:w-auto">
              Become a design partner
            </CtaLink>
          </div>
        </div>
      </Reveal>
    </MarketingSection>
  );
}
