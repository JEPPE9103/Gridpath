import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { isSalesDemoOrganizationSlug } from "@/lib/demo/sales-demo";
import { getOpenCriticalAlertCountForCurrentOrganization } from "@/lib/data/open-alerts";
import { getActiveOrganizationContext } from "@/lib/organization/active-org-context";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const [user, context] = await Promise.all([
    getCurrentUserProfile(),
    getActiveOrganizationContext(),
  ]);

  if (!user) {
    redirect("/login");
  }

  if (!context) {
    redirect("/onboarding");
  }

  const { organization, memberships } = context;
  const criticalAlertCount = await getOpenCriticalAlertCountForCurrentOrganization();
  const workspaceOptions = memberships.map((row) => ({
    id: row.organizationId,
    name: row.organizationName,
    slug: row.organizationSlug,
    role: row.role,
  }));

  return (
    <AppShell
      user={user}
      criticalAlertCount={criticalAlertCount}
      isDemoWorkspace={isSalesDemoOrganizationSlug(organization.slug)}
      activeOrganization={{
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        role: organization.role,
      }}
      organizations={workspaceOptions}
    >
      {children}
    </AppShell>
  );
}
