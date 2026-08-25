import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getCurrentOrganization } from "@/lib/data/organization";
import { getOpenCriticalAlertCountForCurrentOrganization } from "@/lib/data/open-alerts";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const [user, organization] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentOrganization(),
  ]);

  if (!user) {
    redirect("/login");
  }

  if (!organization) {
    redirect("/onboarding");
  }

  const criticalAlertCount = await getOpenCriticalAlertCountForCurrentOrganization();

  return (
    <AppShell user={user} criticalAlertCount={criticalAlertCount}>
      {children}
    </AppShell>
  );
}
