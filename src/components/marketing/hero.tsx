import { CtaLink } from "@/components/marketing/cta-link";
import { DiscoveryPreview } from "@/components/marketing/discovery-preview";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line bg-canvas">
      <div className="mx-auto grid max-w-[1200px] items-center gap-6 px-5 py-8 sm:gap-10 sm:px-8 sm:py-14 md:gap-12 md:px-10 md:py-16 lg:grid-cols-[0.92fr_1.08fr] lg:py-24">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
            Development Intelligence
          </p>
          <h1 className="mt-3 max-w-xl text-[30px] font-semibold leading-[1.1] tracking-tight text-ink sm:mt-4 sm:text-[40px] md:text-[48px] lg:text-[52px]">
            Find and prioritize BESS sites with evidence — not guesswork.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-6 text-muted sm:mt-5 sm:text-base sm:leading-7">
            Noxheim turns public Swedish geospatial evidence into ranked Candidate Sites,
            explicit unknowns, and a clear next step — so development teams move faster with
            fewer false starts.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
            <CtaLink href="/#demo" className="w-full px-5 sm:w-auto">
              Book a demo
            </CtaLink>
            <CtaLink href="/#design-partner" variant="secondary" className="w-full px-5 sm:w-auto">
              Design partner inquiry
            </CtaLink>
          </div>
          <p className="mt-4 text-sm text-muted sm:mt-5">
            Built for BESS developers and advisors screening sites across Sweden.
          </p>
        </div>
        <div className="min-w-0">
          <DiscoveryPreview />
        </div>
      </div>
    </section>
  );
}
