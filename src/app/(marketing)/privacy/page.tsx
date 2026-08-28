import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How NOXHEIM treats information on this website.",
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
          The product demo stores a small amount of workspace state in your browser (for example
          dismissed alerts and checklist updates). That data stays local unless you later connect
          the application to a backend.
        </p>
        <p>
          Indicative grid intelligence shown in the product is for decision support only. Formal
          grid operator assessment is always required.
        </p>
      </div>
    </MarketingSection>
  );
}
