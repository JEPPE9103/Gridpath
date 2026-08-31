export type MembershipRecord = {
  organizationId: string;
  createdAt: string;
};

/**
 * Resolve which organization should be active for the current request.
 * Cookie is a preference only — membership list is authoritative.
 */
export function resolveActiveOrganizationId(
  memberships: MembershipRecord[],
  cookieOrganizationId: string | null,
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

  return sorted[0]?.organizationId ?? null;
}

export function membershipIncludesOrganization(
  memberships: MembershipRecord[],
  organizationId: string,
): boolean {
  return memberships.some((row) => row.organizationId === organizationId);
}
