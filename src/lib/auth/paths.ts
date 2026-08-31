import { userHasAnyOrganizationMembership } from "@/lib/organization/membership";

export async function getPostAuthPath(inviteToken?: string | null): Promise<string> {
  const hasMembership = await userHasAnyOrganizationMembership();
  if (hasMembership) {
    return "/portfolio";
  }

  const token = inviteToken?.trim();
  if (token) {
    return `/invite/${encodeURIComponent(token)}`;
  }

  return "/onboarding";
}
