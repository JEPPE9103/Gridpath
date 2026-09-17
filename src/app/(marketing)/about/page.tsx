import { CtaLink } from "@/components/marketing/cta-link";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "NOXHEIM is Development Intelligence for early physical development decisions. Decision support — not a connection guarantee or final feasibility verdict.",
};

export default function AboutPage() {
  return (
    <MarketingSection>
      <Eyebrow>About</Eyebrow>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Development Intelligence for physical development.
      </h1>
      <div className="mt-8 max-w-2xl space-y-4 text-base leading-7 text-muted">
        <p>
          NOXHEIM helps organisations understand land and sites before committing significant time
          and capital. It brings official evidence together, surfaces constraints and unknowns, and
          clarifies what should be investigated next.
        </p>
        <p>
          The product supports early assessment for an existing location, and geographic search for
          candidate sites. Ranking and recommendations are Noxheim derived from currently available
          evidence. Screening is not engineering feasibility, available capacity, or a connection
          offer.
        </p>
        <p>
          Energy development — including BESS — is the strongest production-ready thesis today.
          Additional development theses may require further datasets and logic; we work with design
          partners on real geographies.
        </p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <CtaLink href="/#demo">Book a demo</CtaLink>
        <CtaLink href="/#demo" variant="secondary">
          Design partner inquiry
        </CtaLink>
      </div>
    </MarketingSection>
  );
}
