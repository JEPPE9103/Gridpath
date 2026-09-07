"use server";

import { getCurrentOrganization } from "@/lib/data/organization";
import { canReviewOfficialChangeImpacts } from "@/lib/domain/official-change-summary";
import type { ChangeReviewStatus } from "@/lib/domain/grid-intelligence";
import { logError } from "@/lib/observability/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const WRITABLE_STATUSES: ChangeReviewStatus[] = ["confirmed", "dismissed"];

export async function updateChangeImpactReview(
  impactId: string,
  reviewStatus: ChangeReviewStatus,
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_PATTERN.test(impactId) || !WRITABLE_STATUSES.includes(reviewStatus)) {
    return { ok: false, error: "Could not update review." };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canReviewOfficialChangeImpacts(organization.role)) {
    return { ok: false, error: "Could not update review." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("review_organization_change_impact", {
    p_impact_id: impactId,
    p_status: reviewStatus,
    p_note: note?.trim() ? note.trim().slice(0, 500) : null,
  });

  if (error) {
    logError("change_impact.review_failed", { message: error.message });
    return { ok: false, error: "Could not update review." };
  }
  const payload = data && typeof data === "object" && !Array.isArray(data) ? (data as { ok?: boolean }) : null;
  if (!payload?.ok) {
    return { ok: false, error: "Could not update review." };
  }

  revalidatePath("/changes");
  revalidatePath("/overview");
  revalidatePath("/alerts");
  revalidatePath("/map");
  revalidatePath("/", "layout");
  return { ok: true };
}
