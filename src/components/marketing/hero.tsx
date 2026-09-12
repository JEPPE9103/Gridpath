import { CtaLink } from "@/components/marketing/cta-link";
import { DiscoveryPreview } from "@/components/marketing/discovery-preview";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line bg-canvas">
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-12 sm:gap-12 sm:px-8 sm:py-16 md:px-10 lg:grid-cols-[0.92fr_1.08fr] lg:py-24">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
            Development Intelligence
          </p>
          <h1 className="mt-4 max-w-xl text-[32px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[40px] md:text-[48px] lg:text-[52px]">
            Find the sites worth investigating.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-muted sm:text-base">
            Screen large areas against official evidence, compare Candidate Sites, understand
            constraints, and move the strongest opportunities into development.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <CtaLink href="/#demo" className="w-full px-5 sm:w-auto">
              Book a demo
            </CtaLink>
            <CtaLink href="/#design-partner" variant="secondary" className="w-full px-5 sm:w-auto">
              Become a design partner
            </CtaLink>
          </div>
          <p className="mt-5 text-sm text-muted">
            Built for BESS, solar, wind and hybrid renewable development teams.
          </p>
        </div>
        <div className="min-w-0">
          <DiscoveryPreview />
        </div>
      </div>
    </section>
  );
}
