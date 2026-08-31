import { SettingsPage } from "@/features/settings/settings-page";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getCurrentOrganization } from "@/lib/data/organization";
import { getTeamForActiveOrganization } from "@/lib/data/team";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [user, organization, team] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentOrganization(),
    getTeamForActiveOrganization(),
  ]);

  if (!user) {
    redirect("/login");
  }

  return <SettingsPage user={user} organization={organization} team={team} />;
}
