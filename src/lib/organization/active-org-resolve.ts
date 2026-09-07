import { SALES_DEMO_ORGANIZATION_ID } from "@/lib/demo/sales-demo";

export type MembershipRecord = {
  organizationId: string;
  createdAt: string;
};

/**
 * Resolve which organization should be active for the current request.
 * Cookie is a preference only — membership list is authoritative.
 * Sample/demo is never chosen as a generic fallback when the user has any other membership.
 */
export function resolveActiveOrganizationId(
  memberships: MembershipRecord[],
  cookieOrganizationId: string | null,
  avoidOrganizationId: string = SALES_DEMO_ORGANIZATION_ID,
): string | null {
  if (memberships.length === 0) {
    return null;
  }

  const sorted = [...memberships].sort((a, b) => {
    const timeDelta = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (timeDelta !== 0) {
      return timeDelta;
    }
    return a.organizationId.localeCompare(b.organizationId);
  });

  if (cookieOrganizationId) {
    const matched = sorted.find((row) => row.organizationId === cookieOrganizationId);
    if (matched) {
      return matched.organizationId;
    }
  }

  const nonAvoided = avoidOrganizationId
    ? sorted.filter((row) => row.organizationId !== avoidOrganizationId)
    : sorted;
  return (nonAvoided[0] ?? sorted[0])?.organizationId ?? null;
}

export function membershipIncludesOrganization(
  memberships: MembershipRecord[],
  organizationId: string,
): boolean {
  return memberships.some((row) => row.organizationId === organizationId);
}
