import { LoginForm } from "@/app/login/login-form";
import { AuthCard } from "@/components/auth/auth-card";
import { getPostAuthPath } from "@/lib/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Sign in" };

type LoginPageProps = {
  searchParams: Promise<{ reset?: string; invite?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(await getPostAuthPath(params.invite));
  }

  return (
    <AuthCard title="Sign in">
      {params.reset === "success" ? (
        <p className="mt-3 text-sm text-muted" role="status">
          Your password was updated. Sign in with your new password.
        </p>
      ) : null}
      <LoginForm inviteToken={params.invite} />
    </AuthCard>
  );
}
