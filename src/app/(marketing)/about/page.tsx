import { CtaLink } from "@/components/marketing/cta-link";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "NOXHEIM is a Grid Intelligence workspace for energy project developers. It shows which projects need attention, why, and what should happen next.",
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
          NOXHEIM is a Grid Intelligence workspace for energy project developers. It connects project
          portfolios with official grid information and the connection workflow, then helps teams
          identify which projects need attention, why, and what should happen next.
        </p>
        <p>
          The product combines projects, official published context, connection workflow and change
          review in one workspace. It is not a public capacity map, and it does not represent
          available grid capacity, connection probability or technical feasibility.
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
