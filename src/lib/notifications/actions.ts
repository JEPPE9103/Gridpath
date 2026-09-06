"use server";

import { getCurrentOrganization } from "@/lib/data/organization";
import { canManageTeam } from "@/lib/organization/team-permissions";
import { logError } from "@/lib/observability/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type NotificationSettingsState = {
  error?: string;
  success?: string;
};

export async function updateNotificationSettingsAction(
  _previous: NotificationSettingsState,
  formData: FormData,
): Promise<NotificationSettingsState> {
  const organization = await getCurrentOrganization();
  if (!organization || !canManageTeam(organization.role)) {
    return { error: "You do not have permission to change notification settings." };
  }

  const digestEnabled = formData.get("digest_enabled") === "on";
  const impactEmailEnabled = formData.get("impact_email_enabled") === "on";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("organization_notification_settings").upsert(
    {
      organization_id: organization.id,
      digest_enabled: digestEnabled,
      impact_email_enabled: impactEmailEnabled,
    },
    { onConflict: "organization_id" },
  );
  if (error) {
    logError("notifications.settings_update_failed", { message: error.message });
    return { error: "Could not save notification settings." };
  }

  revalidatePath("/settings");
  return { success: "Notification settings saved." };
}
