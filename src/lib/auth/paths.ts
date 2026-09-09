import { userHasAnyOrganizationMembership } from "@/lib/organization/membership";

/** First product screen after sign-in or workspace create. */
export const POST_AUTH_HOME = "/overview";

export async function getPostAuthPath(inviteToken?: string | null): Promise<string> {
  const hasMembership = await userHasAnyOrganizationMembership();
  if (hasMembership) {
    return POST_AUTH_HOME;
  }

  const token = inviteToken?.trim();
  if (token) {
    return `/invite/${encodeURIComponent(token)}`;
  }

  return "/onboarding";
}
