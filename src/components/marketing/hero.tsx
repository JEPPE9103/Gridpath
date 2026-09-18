import { CtaLink } from "@/components/marketing/cta-link";
import { DiscoveryPreview } from "@/components/marketing/discovery-preview";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line bg-canvas">
      <div className="mx-auto grid max-w-[1200px] items-center gap-8 px-5 py-10 sm:gap-10 sm:px-8 sm:py-14 md:px-10 lg:grid-cols-[0.42fr_0.58fr] lg:gap-12 lg:py-20">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
            Development Intelligence
          </p>
          <h1 className="mt-3 max-w-xl text-[30px] font-semibold leading-[1.08] tracking-tight text-ink sm:mt-4 sm:text-[40px] md:text-[48px] lg:text-[52px]">
            Know where to investigate before you build.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-6 text-muted sm:mt-5 sm:text-base sm:leading-7">
            Noxheim screens locations with official evidence so development teams can understand
            constraints and unknowns before committing significant time and capital.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
            <CtaLink href="/#demo" className="w-full px-5 sm:w-auto">
              Book a demo
            </CtaLink>
            <CtaLink href="/#how-it-works" variant="secondary" className="w-full px-5 sm:w-auto">
              See how it works
            </CtaLink>
          </div>
        </div>
        <div className="min-w-0">
          <DiscoveryPreview />
        </div>
      </div>
    </section>
  );
}
