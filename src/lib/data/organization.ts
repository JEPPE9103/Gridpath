import { organizationRoleLabel } from "@/lib/data/organization-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export { organizationRoleLabel };

export type CurrentOrganization = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type OrganizationEmbed = {
  id: string;
  name: string;
  slug: string;
};

type MembershipRow = {
  role: string;
  organizations: OrganizationEmbed | OrganizationEmbed[] | null;
};

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getCurrentOrganization(): Promise<CurrentOrganization | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Multiple memberships are allowed; use the earliest. Workspace switching is not built.
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organizations ( id, name, slug )")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getCurrentOrganization failed", error.message);
    return null;
  }

  const row = data as MembershipRow | null;
  const organization = asSingle(row?.organizations);
  if (!row || !organization) {
    return null;
  }

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    role: row.role,
  };
}
