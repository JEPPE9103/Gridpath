import { CtaLink } from "@/components/marketing/cta-link";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "NOXHEIM is Grid Intelligence software for energy developers. Official Swedish grid context, connection tracking and published-plan changes.",
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
          NOXHEIM is Grid Intelligence software for professional energy developers. It places
          official Energimarknadsinspektionen local-network areas and network development plans on
          each site, keeps connection cases and documents in one workspace, and can show when a
          published dataset changes around a project.
        </p>
        <p>
          It does not guarantee grid capacity, derive available MW, or treat forecast figures as
          headroom. Official operator assessment remains required. Sources, publication dates and
          retrieved times are meant to stay visible.
        </p>
        <p>
          The company is early-stage. Book a demo or create an account to evaluate the workspace on
          your own projects.
        </p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <CtaLink href="/#demo">Book a demo</CtaLink>
        <CtaLink href="/signup" variant="secondary">
          Get started
        </CtaLink>
      </div>
    </MarketingSection>
  );
}
