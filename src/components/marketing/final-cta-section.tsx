import Link from "next/link";
import { CtaLink } from "@/components/marketing/cta-link";
import { Reveal } from "@/components/marketing/reveal";
import { MarketingSection } from "@/components/marketing/section";

export function FinalCtaSection() {
  return (
    <MarketingSection className="bg-surface">
      <Reveal>
        <h2 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-[42px] sm:leading-[1.12]">
          Make the next development decision with better evidence.
        </h2>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted">
          See Noxheim on the geographies you develop — Search Area, Candidate Intelligence,
          Evidence Coverage and decision trail in one workspace.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <CtaLink href="/#demo" className="w-full px-5 sm:w-auto">
            Book a demo
          </CtaLink>
          <p className="max-w-sm text-sm leading-6 text-muted sm:pl-2">
            Interested in applying Noxheim to a new development thesis?{" "}
            <Link href="/#demo" className="font-medium text-ink underline-offset-4 hover:underline">
              Talk to us about becoming a design partner
            </Link>
            .
          </p>
        </div>
      </Reveal>
    </MarketingSection>
  );
}
