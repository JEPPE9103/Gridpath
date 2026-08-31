import { cookies } from "next/headers";

export const ACTIVE_ORGANIZATION_COOKIE = "noxheim_active_organization";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f12]{12}$/i;

export function activeOrganizationCookieAttributes(clearing = false) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: clearing ? 0 : 60 * 60 * 24 * 365,
  };
}

export function isOrganizationId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

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
