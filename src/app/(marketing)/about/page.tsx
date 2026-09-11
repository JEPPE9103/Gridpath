import { CtaLink } from "@/components/marketing/cta-link";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "NOXHEIM is a Development Intelligence platform for Swedish BESS and renewable development teams. Decision support — not a connection guarantee.",
};

export default function AboutPage() {
  return (
    <MarketingSection>
      <Eyebrow>About</Eyebrow>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Development Intelligence for BESS and renewable teams.
      </h1>
      <div className="mt-8 max-w-2xl space-y-4 text-base leading-7 text-muted">
        <p>
          NOXHEIM is a Development Intelligence platform for Swedish BESS and renewable development
          teams. It helps teams search real geography, identify Candidate Sites worth investigating,
          see evaluated versus missing evidence, and carry kept opportunities into project
          development and connection tracking.
        </p>
        <p>
          Official grid information in the product is covering geography and published source
          context — not available capacity. Ranking is Noxheim derived, not an official verdict.
          Screening is not engineering feasibility. Noxheim does not estimate connection
          probability or replace network-operator assessments.
        </p>
        <p>
          We work with a small number of Swedish BESS and renewable development teams. Book a demo
          to see the workspace on geographies you actually develop.
        </p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <CtaLink href="/#demo">Book a demo</CtaLink>
        <CtaLink href="/#design-partner" variant="secondary">
          Become a design partner
        </CtaLink>
      </div>
    </MarketingSection>
  );
}
