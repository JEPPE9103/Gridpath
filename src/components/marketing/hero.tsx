import { CtaLink } from "@/components/marketing/cta-link";
import { ProductPreview } from "@/components/marketing/product-preview";
import Link from "next/link";

export function Hero() {
  return (
    <section className="marketing-grid relative overflow-hidden border-b border-line">
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-5 py-12 sm:gap-12 sm:px-8 sm:py-16 md:px-10 lg:grid-cols-[0.92fr_1.08fr] lg:py-24">
        <div>
          <p className="marketing-enter text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
            Grid development intelligence
          </p>
          <h1
            className="marketing-enter mt-4 max-w-xl text-[32px] font-semibold leading-[1.1] tracking-tight text-ink sm:text-[40px] md:text-[52px] lg:text-[56px]"
            style={{ animationDelay: "80ms" }}
          >
            Run grid connections from one place.
          </h1>
          <p
            className="marketing-enter mt-5 max-w-md text-[15px] leading-7 text-muted sm:text-base"
            style={{ animationDelay: "160ms" }}
          >
            Screen sites, manage connection processes and monitor published grid changes across your
            development portfolio.
          </p>
          <div
            className="marketing-enter mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
            style={{ animationDelay: "240ms" }}
          >
            <CtaLink href="/signup" className="w-full px-5 sm:w-auto">
              Get started
            </CtaLink>
            <CtaLink href="/#demo" variant="secondary" className="w-full px-5 sm:w-auto">
              Book a demo
            </CtaLink>
          </div>
          <p
            className="marketing-enter mt-4 text-sm text-muted"
            style={{ animationDelay: "280ms" }}
          >
            Prefer a guided walkthrough?{" "}
            <Link href="/overview" className="font-medium text-teal hover:text-teal-dark">
              Open product demo
            </Link>
          </p>
          <p
            className="marketing-enter mt-5 text-sm text-muted"
            style={{ animationDelay: "320ms" }}
          >
            Built for energy developers managing complex grid-connected portfolios.
          </p>
        </div>
        <div className="marketing-enter min-w-0" style={{ animationDelay: "180ms" }}>
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}
