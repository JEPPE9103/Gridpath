import { SettingsPage } from "@/features/settings/settings-page";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getCurrentOrganization } from "@/lib/data/organization";
import { getOfficialSourceHealth } from "@/lib/data/source-health";
import { getTeamForActiveOrganization } from "@/lib/data/team";
import { getNotificationSettings } from "@/lib/data/notification-settings";
import { isInviteEmailConfigured } from "@/lib/organization/invite-email";
import { canManageTeam } from "@/lib/organization/team-permissions";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [user, organization, team, sourceHealth, notificationSettings] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentOrganization(),
    getTeamForActiveOrganization(),
    getOfficialSourceHealth(),
    getNotificationSettings(),
  ]);

  if (!user) {
    redirect("/login");
  }

  return (
    <SettingsPage
      user={user}
      organization={organization}
      team={team}
      inviteEmailConfigured={isInviteEmailConfigured()}
      sourceHealth={sourceHealth}
      notificationSettings={notificationSettings}
      canManageNotifications={canManageTeam(organization?.role)}
    />
  );
}
