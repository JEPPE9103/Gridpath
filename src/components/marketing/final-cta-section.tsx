import { CtaLink } from "@/components/marketing/cta-link";
import { Reveal } from "@/components/marketing/reveal";
import { MarketingSection } from "@/components/marketing/section";

export function FinalCtaSection() {
  return (
    <MarketingSection className="bg-surface">
      <Reveal>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-[42px] sm:leading-[1.12]">
          Your grid data is fragmented. Your portfolio doesn&apos;t have to be.
        </h2>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted">
          Bring screening, connection workflow and relevant published changes into one development
          workspace.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <CtaLink href="/signup" className="w-full px-5 sm:w-auto">
            Get started
          </CtaLink>
          <CtaLink href="/#demo" variant="secondary" className="w-full px-5 sm:w-auto">
            Book a demo
          </CtaLink>
        </div>
      </Reveal>
    </MarketingSection>
  );
}
