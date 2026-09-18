import { CandidateIntelligenceSection } from "@/components/marketing/candidate-intelligence-section";
import { CompareSection } from "@/components/marketing/compare-section";
import { DataTrustSection } from "@/components/marketing/data-trust-section";
import { DemoCTA } from "@/components/marketing/demo-cta";
import { Hero } from "@/components/marketing/hero";
import { HowItWorksSection } from "@/components/marketing/how-it-works-section";
import { UseCases } from "@/components/marketing/use-cases";
import { ValueSection } from "@/components/marketing/value-section";
import type { Metadata } from "next";

const DESCRIPTION =
  "Screen locations with official evidence, generate Candidate Sites, surface constraints and unknowns, compare alternatives and prioritise the next investigation.";

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
      <HowItWorksSection />
      <CandidateIntelligenceSection />
      <CompareSection />
      <UseCases />
      <DataTrustSection />
      <DemoCTA />
    </main>
  );
}
