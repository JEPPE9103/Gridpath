import { getActiveOrganizationContext } from "@/lib/organization/active-org-context";

export async function userHasAnyOrganizationMembership(): Promise<boolean> {
  const context = await getActiveOrganizationContext();
  return context != null;
}
