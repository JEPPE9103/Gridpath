import { SettingsPage } from "@/features/settings/settings-page";
import { getCurrentUserProfile } from "@/lib/auth/current-user";
import { getCurrentOrganization } from "@/lib/data/organization";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const [user, organization] = await Promise.all([
    getCurrentUserProfile(),
    getCurrentOrganization(),
  ]);

  if (!user) {
    redirect("/login");
  }

  return <SettingsPage user={user} organization={organization} />;
}
