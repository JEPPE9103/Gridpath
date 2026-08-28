import { ForgotPasswordForm } from "@/app/forgot-password/forgot-password-form";
import { AuthCard } from "@/components/auth/auth-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPostAuthPath } from "@/lib/auth/paths";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Forgot password" };

export default async function ForgotPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(await getPostAuthPath());
  }

  return (
    <AuthCard title="Reset password">
      <p className="mt-3 text-sm text-muted">
        Enter your work email and we&apos;ll send a link to choose a new password.
      </p>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
