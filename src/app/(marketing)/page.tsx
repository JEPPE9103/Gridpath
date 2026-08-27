import { DataTrustSection } from "@/components/marketing/data-trust-section";
import { DemoCTA } from "@/components/marketing/demo-cta";
import { Hero } from "@/components/marketing/hero";
import { ProductPillars } from "@/components/marketing/product-pillars";
import { ProductProof } from "@/components/marketing/product-proof";
import { UseCases } from "@/components/marketing/use-cases";
import { ValueSection } from "@/components/marketing/value-section";
import { WhySection } from "@/components/marketing/why-section";
import { WorkflowSection } from "@/components/marketing/workflow-section";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "NOXHEIM — Grid Development Intelligence",
  },
  description:
    "Official Swedish grid context for energy development portfolios. Ei local-network areas, network development plans, connection tracking and published-plan changes.",
  openGraph: {
    title: "NOXHEIM — Grid Development Intelligence",
    description:
      "Official Swedish grid context for energy development portfolios. Ei local-network areas, network development plans, connection tracking and published-plan changes.",
    type: "website",
    locale: "en_GB",
    siteName: "NOXHEIM",
  },
  twitter: {
    card: "summary_large_image",
    title: "NOXHEIM — Grid Development Intelligence",
    description:
      "Official Swedish grid context for energy development portfolios. Ei local-network areas, network development plans, connection tracking and published-plan changes.",
  },
};

export default function MarketingHomePage() {
  return (
    <main>
      <Hero />
      <ValueSection />
      <ProductPillars />
      <WorkflowSection />
      <ProductProof />
      <WhySection />
      <UseCases />
      <DataTrustSection />
      <DemoCTA />
    </main>
  );
}
