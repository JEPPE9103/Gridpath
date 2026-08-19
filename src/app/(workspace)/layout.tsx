import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUserProfile();

  if (!user) {
    redirect("/login");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
