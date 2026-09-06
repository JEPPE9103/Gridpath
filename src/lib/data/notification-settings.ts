import { getCurrentOrganization } from "@/lib/data/organization";
import { logError } from "@/lib/observability/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type NotificationSettings = {
  digestEnabled: boolean;
  impactEmailEnabled: boolean;
};

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { digestEnabled: true, impactEmailEnabled: true };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_notification_settings")
    .select("digest_enabled, impact_email_enabled")
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (error) {
    logError("notifications.settings_load_failed", { message: error.message });
    return { digestEnabled: true, impactEmailEnabled: true };
  }
  if (!data) {
    return { digestEnabled: true, impactEmailEnabled: true };
  }
  return {
    digestEnabled: data.digest_enabled !== false,
    impactEmailEnabled: data.impact_email_enabled !== false,
  };
}
