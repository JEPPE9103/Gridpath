import {
  ACTIVE_ORGANIZATION_COOKIE,
  activeOrganizationCookieAttributes,
  isOrganizationId,
} from "@/lib/organization/active-org-cookie-constants";
import { cookies } from "next/headers";

export {
  ACTIVE_ORGANIZATION_COOKIE,
  activeOrganizationCookieAttributes,
  isOrganizationId,
} from "@/lib/organization/active-org-cookie-constants";

export async function readActiveOrganizationCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value?.trim() ?? null;
  return isOrganizationId(value) ? value : null;
}

export async function writeActiveOrganizationCookie(organizationId: string): Promise<void> {
  if (!isOrganizationId(organizationId)) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, activeOrganizationCookieAttributes());
}

export async function clearActiveOrganizationCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    ACTIVE_ORGANIZATION_COOKIE,
    "",
    activeOrganizationCookieAttributes(true),
  );
}
