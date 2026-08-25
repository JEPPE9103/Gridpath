import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import { getCurrentOrganization } from "@/lib/data/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Create workspace" };

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organization = await getCurrentOrganization();
  if (organization) {
    redirect("/portfolio");
  }

  return <OnboardingForm />;
}
