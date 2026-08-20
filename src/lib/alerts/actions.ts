"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function dismissOrganizationAlert(
  alertId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_PATTERN.test(alertId)) {
    return { ok: false, error: "Could not dismiss alert." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("alerts")
    .update({ status: "dismissed" })
    .eq("id", alertId)
    .eq("status", "open")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("dismissOrganizationAlert failed", error.message);
    }
    return { ok: false, error: "Could not dismiss alert." };
  }

  revalidatePath("/overview");
  revalidatePath("/", "layout");
  return { ok: true };
}
