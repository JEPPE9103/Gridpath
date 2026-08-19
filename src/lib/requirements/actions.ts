"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/;

export async function markRequirementComplete(
  requirementId: string,
  projectSlug: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_PATTERN.test(requirementId) || !SLUG_PATTERN.test(projectSlug)) {
    return { ok: false, error: "Could not update requirement." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: requirement, error: loadError } = await supabase
    .from("project_requirements")
    .select("id, project_id, label, status")
    .eq("id", requirementId)
    .maybeSingle();

  if (loadError || !requirement) {
    if (loadError) {
      console.error("markRequirementComplete load failed", loadError.message);
    }
    return { ok: false, error: "Could not update requirement." };
  }

  if (requirement.status === "complete") {
    revalidatePath(`/projects/${projectSlug}`);
    return { ok: true };
  }

  const { data: updated, error: updateError } = await supabase
    .from("project_requirements")
    .update({ status: "complete" })
    .eq("id", requirementId)
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    if (updateError) {
      console.error("markRequirementComplete update failed", updateError.message);
    }
    return { ok: false, error: "Could not update requirement." };
  }

  const { error: eventError } = await supabase.from("project_events").insert({
    project_id: requirement.project_id,
    title: "Requirement marked complete",
    detail: requirement.label,
    source: "Customer Data",
  });
  if (eventError) {
    console.error("markRequirementComplete event failed", eventError.message);
  }

  revalidatePath(`/projects/${projectSlug}`);
  return { ok: true };
}
