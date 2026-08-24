"use server";

import { getCurrentOrganization } from "@/lib/data/organization";
import type { ChangeReviewStatus } from "@/lib/domain/grid-intelligence";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const WRITABLE_STATUSES: ChangeReviewStatus[] = ["confirmed", "dismissed"];

function canWrite(role: string): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

export async function updateChangeImpactReview(
  impactId: string,
  reviewStatus: ChangeReviewStatus,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_PATTERN.test(impactId) || !WRITABLE_STATUSES.includes(reviewStatus)) {
    return { ok: false, error: "Could not update review." };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canWrite(organization.role)) {
    return { ok: false, error: "Could not update review." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Could not update review." };
  }

  const { data: existing, error: loadError } = await supabase
    .from("change_impacts")
    .select("id, organization_id, review_status")
    .eq("id", impactId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (loadError || !existing) {
    if (loadError) {
      console.error("updateChangeImpactReview load failed", loadError.message);
    }
    return { ok: false, error: "Could not update review." };
  }

  const reviewedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("change_impacts")
    .update({
      review_status: reviewStatus,
      reviewed_by: user.id,
      reviewed_at: reviewedAt,
    })
    .eq("id", impactId)
    .eq("organization_id", organization.id)
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    if (updateError) {
      console.error("updateChangeImpactReview update failed", updateError.message);
    }
    return { ok: false, error: "Could not update review." };
  }

  revalidatePath("/changes");
  return { ok: true };
}
