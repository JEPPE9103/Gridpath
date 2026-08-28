import { ResetPasswordForm } from "@/app/reset-password/reset-password-form";
import { AuthCard } from "@/components/auth/auth-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Choose new password" };

type ResetPasswordPageProps = {
  searchParams: Promise<{ state?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const linkState = params.state;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (linkState === "expired") {
    return (
      <AuthCard title="Reset link expired">
        <p className="mt-3 text-sm text-muted">
          This password reset link has expired. Request a new one from the sign-in page.
        </p>
        <p className="mt-6 text-sm">
          <a href="/forgot-password" className="font-medium text-teal hover:text-teal-dark">
            Request new reset link
          </a>
        </p>
      </AuthCard>
    );
  }

  if (linkState === "invalid") {
    return (
      <AuthCard title="Invalid reset link">
        <p className="mt-3 text-sm text-muted">
          This link is invalid or has already been used. Request a new password reset email.
        </p>
        <p className="mt-6 text-sm">
          <a href="/forgot-password" className="font-medium text-teal hover:text-teal-dark">
            Request new reset link
          </a>
        </p>
      </AuthCard>
    );
  }

  if (linkState === "rate_limit") {
    return (
      <AuthCard title="Too many attempts">
        <p className="mt-3 text-sm text-muted">
          Too many reset attempts. Please wait a few minutes before trying again.
        </p>
        <p className="mt-6 text-sm">
          <a href="/forgot-password" className="font-medium text-teal hover:text-teal-dark">
            Back to reset password
          </a>
        </p>
      </AuthCard>
    );
  }

  if (!user) {
    return (
      <AuthCard title="Invalid reset link">
        <p className="mt-3 text-sm text-muted">
          Open the reset link from your email to choose a new password. Links expire after a short
          time.
        </p>
        <p className="mt-6 text-sm">
          <a href="/forgot-password" className="font-medium text-teal hover:text-teal-dark">
            Request new reset link
          </a>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose new password">
      <p className="mt-3 text-sm text-muted">Enter a new password for your NOXHEIM account.</p>
      <ResetPasswordForm />
    </AuthCard>
  );
}
