import { CtaLink } from "@/components/marketing/cta-link";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "NOXHEIM is Grid Intelligence software for energy developers managing grid-connected portfolios.",
};

export default function AboutPage() {
  return (
    <MarketingSection>
      <Eyebrow>About</Eyebrow>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Software for grid-connected development.
      </h1>
      <div className="mt-8 max-w-2xl space-y-4 text-base leading-7 text-muted">
        <p>
          NOXHEIM is Grid Intelligence software for professional energy developers. It helps teams
          screen sites, run connection processes, monitor operator and grid-information change, and
          keep documents and deadlines in one workspace.
        </p>
        <p>
          It does not guarantee grid capacity. Official operator assessment remains required.
          NOXHEIM is built to make sources, confidence and process state visible — so development
          teams can decide where to spend engineering time.
        </p>
        <p>The company is early-stage. The product demo is the best way to evaluate the system.</p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <CtaLink href="/#demo">Book a demo</CtaLink>
        <CtaLink href="/overview" variant="secondary">
          Open product demo
        </CtaLink>
      </div>
    </MarketingSection>
  );
}
