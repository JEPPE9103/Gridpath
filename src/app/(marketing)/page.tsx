import { DataTrustSection } from "@/components/marketing/data-trust-section";
import { DecisionSupportSection } from "@/components/marketing/decision-support-section";
import { DemoCTA } from "@/components/marketing/demo-cta";
import { DesignPartnerSection } from "@/components/marketing/design-partner-section";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { Hero } from "@/components/marketing/hero";
import { ProductPillars } from "@/components/marketing/product-pillars";
import { ProductPreviewSection } from "@/components/marketing/product-preview-section";
import { UseCases } from "@/components/marketing/use-cases";
import { ValueSection } from "@/components/marketing/value-section";
import { WhySection } from "@/components/marketing/why-section";
import { WorkflowSection } from "@/components/marketing/workflow-section";
import type { Metadata } from "next";

const DESCRIPTION =
  "Screen, manage and monitor grid-connected development projects with official grid context and your development workflow in one place.";

export const metadata: Metadata = {
  title: {
    absolute: "NOXHEIM — Grid Development Intelligence",
  },
  description: DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "NOXHEIM — Grid Development Intelligence",
    description: DESCRIPTION,
    type: "website",
    locale: "en_GB",
    siteName: "NOXHEIM",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "NOXHEIM — Grid Development Intelligence",
    description: DESCRIPTION,
  },
};

export default function MarketingHomePage() {
  return (
    <main>
      <Hero />
      <ValueSection />
      <ProductPreviewSection />
      <ProductPillars />
      <WorkflowSection />
      <WhySection />
      <UseCases />
      <DataTrustSection />
      <DecisionSupportSection />
      <DesignPartnerSection />
      <DemoCTA />
      <FinalCtaSection />
    </main>
  );
}
