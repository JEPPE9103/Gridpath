import { getCurrentOrganization } from "@/lib/data/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getOpenCriticalAlertCountForCurrentOrganization(): Promise<number> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return 0;
  }

  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("alerts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .eq("status", "open")
    .eq("severity", "critical");

  if (error) {
    console.error("getOpenCriticalAlertCountForCurrentOrganization failed", error.message);
    return 0;
  }

  return count ?? 0;
}
