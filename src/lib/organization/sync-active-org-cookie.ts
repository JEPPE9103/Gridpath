import {
  ACTIVE_ORGANIZATION_COOKIE,
  isOrganizationId,
} from "@/lib/organization/active-org-cookie-constants";
import {
  readActiveOrganizationCookie,
  writeActiveOrganizationCookie,
} from "@/lib/organization/active-org-cookie";
import {
  resolveActiveOrganizationId,
  type MembershipRecord,
} from "@/lib/organization/active-org-resolve";
import { getActiveOrganizationContext } from "@/lib/organization/active-org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function loadMembershipRecords(userId: string): Promise<MembershipRecord[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, created_at")
    .eq("profile_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("loadMembershipRecords failed", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    organizationId: row.organization_id as string,
    createdAt: row.created_at as string,
  }));
}

export async function resolveActiveOrganizationIdForUser(
  userId: string,
  cookieOrganizationId: string | null,
): Promise<string | null> {
  const memberships = await loadMembershipRecords(userId);
  return resolveActiveOrganizationId(memberships, cookieOrganizationId);
}

export async function syncActiveOrganizationCookie(): Promise<void> {
  const context = await getActiveOrganizationContext();
  if (!context) {
    return;
  }

  const cookieOrganizationId = await readActiveOrganizationCookie();
  if (cookieOrganizationId === context.organization.id) {
    return;
  }

  await writeActiveOrganizationCookie(context.organization.id);
}

export function readActiveOrganizationCookieFromRequest(
  getCookie: (name: string) => { value: string } | undefined,
): string | null {
  const value = getCookie(ACTIVE_ORGANIZATION_COOKIE)?.value?.trim() ?? null;
  return isOrganizationId(value) ? value : null;
}
