import { CompareSection } from "@/components/marketing/compare-section";
import { ConnectMonitorSection } from "@/components/marketing/connect-monitor-section";
import { DataTrustSection } from "@/components/marketing/data-trust-section";
import { DecisionSupportSection } from "@/components/marketing/decision-support-section";
import { DemoCTA } from "@/components/marketing/demo-cta";
import { DesignPartnerSection } from "@/components/marketing/design-partner-section";
import { EvidenceSection } from "@/components/marketing/evidence-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { FindSitesSection } from "@/components/marketing/find-sites-section";
import { Hero } from "@/components/marketing/hero";
import { LifecycleSection } from "@/components/marketing/lifecycle-section";
import { MapWorkspaceSection } from "@/components/marketing/map-workspace-section";
import { UseCases } from "@/components/marketing/use-cases";
import { ValueSection } from "@/components/marketing/value-section";
import type { Metadata } from "next";

const DESCRIPTION =
  "Development Intelligence for Swedish BESS and renewable development teams. Search geography, identify Candidate Sites, understand the evidence, and carry opportunities into development.";

export const metadata: Metadata = {
  title: {
    absolute: "NOXHEIM — Development Intelligence",
  },
  description: DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "NOXHEIM — Development Intelligence",
    description: DESCRIPTION,
    type: "website",
    locale: "en_GB",
    siteName: "NOXHEIM",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "NOXHEIM — Development Intelligence",
    description: DESCRIPTION,
  },
};

export default function MarketingHomePage() {
  return (
    <main>
      <Hero />
      <ValueSection />
      <FindSitesSection />
      <EvidenceSection />
      <CompareSection />
      <LifecycleSection />
      <MapWorkspaceSection />
      <ConnectMonitorSection />
      <UseCases />
      <DataTrustSection />
      <DecisionSupportSection />
      <DesignPartnerSection />
      <DemoCTA />
      <FinalCtaSection />
    </main>
  );
}
