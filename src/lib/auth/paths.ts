import { getCurrentOrganization } from "@/lib/data/organization";

export async function getPostAuthPath(): Promise<"/portfolio" | "/onboarding"> {
  const organization = await getCurrentOrganization();
  return organization ? "/portfolio" : "/onboarding";
}
