"use server";

import { getActiveOrganizationContext } from "@/lib/organization/active-org-context";
import {
  membershipIncludesOrganization,
  type MembershipRecord,
} from "@/lib/organization/active-org-resolve";
import {
  isOrganizationId,
  writeActiveOrganizationCookie,
} from "@/lib/organization/active-org-cookie";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type SwitchWorkspaceResult = {
  ok: boolean;
  error?: string;
};

export async function switchActiveOrganization(
  organizationId: string,
): Promise<SwitchWorkspaceResult> {
  if (!isOrganizationId(organizationId)) {
    return { ok: false, error: "Could not switch workspace." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sign in to switch workspace." };
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, created_at")
    .eq("profile_id", user.id);

  if (error) {
    console.error("switchActiveOrganization membership lookup failed", error.message);
    return { ok: false, error: "Could not switch workspace." };
  }

  const memberships: MembershipRecord[] = (data ?? []).map((row) => ({
    organizationId: row.organization_id as string,
    createdAt: row.created_at as string,
  }));

  if (!membershipIncludesOrganization(memberships, organizationId)) {
    return { ok: false, error: "Could not switch workspace." };
  }

  await writeActiveOrganizationCookie(organizationId);
  revalidatePath("/", "layout");
  redirect("/overview");
}

export async function getWorkspaceSwitcherData() {
  const context = await getActiveOrganizationContext();
  if (!context) {
    return null;
  }

  return {
    activeOrganization: context.organization,
    memberships: context.memberships.map((row) => ({
      id: row.organizationId,
      name: row.organizationName,
      slug: row.organizationSlug,
      role: row.role,
    })),
  };
}
