import { LoginForm } from "@/app/login/login-form";
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
    redirect("/portfolio");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[380px] rounded-md border border-line bg-surface p-8">
        <p className="text-[15px] font-semibold tracking-[0.18em] text-ink">NOXHEIM</p>
        <p className="mt-1 text-[11px] tracking-wide text-muted">Grid Intelligence</p>
        <LoginForm />
      </div>
    </main>
  );
}
