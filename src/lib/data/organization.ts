import { getActiveOrganizationContext } from "@/lib/organization/active-org-context";

export { organizationRoleLabel } from "@/lib/data/organization-role";

export type CurrentOrganization = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export async function getCurrentOrganization(): Promise<CurrentOrganization | null> {
  const context = await getActiveOrganizationContext();
  return context?.organization ?? null;
}
