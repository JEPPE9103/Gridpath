import { cache } from "react";
import type { CurrentOrganization } from "@/lib/data/organization";
import {
  membershipIncludesOrganization,
  resolveActiveOrganizationId,
  type MembershipRecord,
} from "@/lib/organization/active-org-resolve";
import { readActiveOrganizationCookie } from "@/lib/organization/active-org-cookie";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrganizationMembership = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: string;
  createdAt: string;
};

export type ActiveOrganizationContext = {
  userId: string;
  organization: CurrentOrganization;
  memberships: OrganizationMembership[];
};

type OrganizationEmbed = {
  id: string;
  name: string;
  slug: string;
};

type MembershipRow = {
  role: string;
  created_at: string;
  organization_id: string;
  organizations: OrganizationEmbed | OrganizationEmbed[] | null;
};

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapMemberships(rows: MembershipRow[]): OrganizationMembership[] {
  return rows
    .map((row) => {
      const organization = asSingle(row.organizations);
      if (!organization) {
        return null;
      }
      return {
        organizationId: organization.id,
        organizationName: organization.name,
        organizationSlug: organization.slug,
        role: row.role,
        createdAt: row.created_at,
      };
    })
    .filter((row): row is OrganizationMembership => row !== null)
    .sort((a, b) => {
      const timeDelta = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (timeDelta !== 0) {
        return timeDelta;
      }
      return a.organizationName.localeCompare(b.organizationName, "sv");
    });
}

async function loadMemberships(userId: string): Promise<OrganizationMembership[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, created_at, organization_id, organizations ( id, name, slug )")
    .eq("profile_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("loadMemberships failed", error.message);
    return [];
  }

  return mapMemberships((data ?? []) as MembershipRow[]);
}

export const getActiveOrganizationContext = cache(
  async (): Promise<ActiveOrganizationContext | null> => {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const memberships = await loadMemberships(user.id);
    if (memberships.length === 0) {
      return null;
    }

    const cookieOrganizationId = await readActiveOrganizationCookie();
    const membershipRecords: MembershipRecord[] = memberships.map((row) => ({
      organizationId: row.organizationId,
      createdAt: row.createdAt,
    }));

    const activeOrganizationId = resolveActiveOrganizationId(
      membershipRecords,
      cookieOrganizationId,
    );

    if (!activeOrganizationId) {
      return null;
    }

    const activeMembership = memberships.find(
      (row) => row.organizationId === activeOrganizationId,
    );
    if (!activeMembership) {
      return null;
    }

    return {
      userId: user.id,
      organization: {
        id: activeMembership.organizationId,
        name: activeMembership.organizationName,
        slug: activeMembership.organizationSlug,
        role: activeMembership.role,
      },
      memberships,
    };
  },
);

export async function assertActiveOrganizationMembership(
  organizationId: string,
): Promise<ActiveOrganizationContext | null> {
  const context = await getActiveOrganizationContext();
  if (!context) {
    return null;
  }

  if (!membershipIncludesOrganization(
    context.memberships.map((row) => ({
      organizationId: row.organizationId,
      createdAt: row.createdAt,
    })),
    organizationId,
  )) {
    return null;
  }

  return context;
}
