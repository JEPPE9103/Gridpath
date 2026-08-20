import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getOpenCriticalAlertCountForCurrentOrganization } from "@/lib/data/open-alerts";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUserProfile();

  if (!user) {
    redirect("/login");
  }

  const criticalAlertCount = await getOpenCriticalAlertCountForCurrentOrganization();

  return (
    <AppShell user={user} criticalAlertCount={criticalAlertCount}>
      {children}
    </AppShell>
  );
}
