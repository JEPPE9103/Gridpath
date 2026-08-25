import { SignupForm } from "@/app/signup/signup-form";
import { getPostAuthPath } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(await getPostAuthPath());
  }

  return <SignupForm />;
}
