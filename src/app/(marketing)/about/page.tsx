import { CtaLink } from "@/components/marketing/cta-link";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "Noxheim is the development intelligence and workflow layer for grid-connected development portfolios.",
};

export default function AboutPage() {
  return (
    <MarketingSection>
      <Eyebrow>About</Eyebrow>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Development intelligence for grid-connected portfolios.
      </h1>
      <div className="mt-8 max-w-2xl space-y-4 text-base leading-7 text-muted">
        <p>
          Noxheim helps development teams understand which projects deserve attention, manage what
          happens next, and see when published information changes around the portfolio.
        </p>
        <p>
          The product combines projects, official external context, development workflow and change
          awareness in one workspace. It is not a public capacity map, and it does not represent
          available grid capacity or guarantee connection feasibility.
        </p>
        <p>
          We are working with a small number of Swedish BESS and renewable development teams. Book a
          demo or create an account to evaluate the workspace on your own projects.
        </p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <CtaLink href="/signup">Get started</CtaLink>
        <CtaLink href="/#demo" variant="secondary">
          Book a demo
        </CtaLink>
      </div>
    </MarketingSection>
  );
}
