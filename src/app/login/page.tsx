import { LoginForm } from "@/app/login/login-form";
import { AuthCard } from "@/components/auth/auth-card";
import { getPostAuthPath } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(await getPostAuthPath());
  }

  return (
    <AuthCard title="Sign in">
      <LoginForm />
    </AuthCard>
  );
}
