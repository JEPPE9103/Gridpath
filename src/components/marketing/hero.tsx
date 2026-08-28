import { CtaLink } from "@/components/marketing/cta-link";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line bg-canvas">
      <div className="mx-auto max-w-[800px] px-5 py-16 sm:px-8 sm:py-20 md:px-10 lg:py-28">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
          Grid Development Intelligence
        </p>
        <h1 className="mt-4 max-w-3xl text-[32px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[44px] md:text-[56px]">
          Know which projects deserve your development capital.
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-7 text-muted sm:text-base">
          Screen, manage and monitor grid-connected development projects with official grid context
          and your development workflow in one place.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <CtaLink href="/signup" className="w-full px-5 sm:w-auto">
            Get started
          </CtaLink>
          <CtaLink href="/#demo" variant="secondary" className="w-full px-5 sm:w-auto">
            Book a demo
          </CtaLink>
        </div>
        <p className="mt-5 text-sm text-muted">Built for BESS and renewable development teams.</p>
      </div>
    </section>
  );
}
