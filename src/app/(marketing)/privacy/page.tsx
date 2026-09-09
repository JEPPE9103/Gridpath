import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How NOXHEIM treats information on this website and in the product workspace.",
};

export default function PrivacyPage() {
  return (
    <MarketingSection>
      <Eyebrow>Privacy</Eyebrow>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">Privacy</h1>
      <div className="mt-8 max-w-2xl space-y-4 text-base leading-7 text-muted">
        <p>
          Demo requests submitted on this website are stored securely so the NOXHEIM team can follow
          up. We do not sell contact details to third parties.
        </p>
        <p>
          When you create a workspace, project data, connection workflow, documents and team
          activity are stored in your organisation&apos;s tenant. Official published grid information
          is shared source context. Project-specific records stay scoped to your organisation.
        </p>
        <p>
          Official grid context in the product is published source information and geographic match
          for team review. It is not available grid capacity, connection probability or a substitute
          for formal network-operator assessment.
        </p>
      </div>
    </MarketingSection>
  );
}
