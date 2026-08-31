import { getCurrentOrganization } from "@/lib/data/organization";
import { organizationRoleLabel } from "@/lib/data/organization-role";
import { canManageTeam } from "@/lib/organization/team-permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TeamMemberItem = {
  membershipId: string;
  profileId: string;
  fullName: string;
  jobTitle: string | null;
  email: string;
  role: string;
  roleLabel: string;
  joinedAt: string;
};

export type PendingInviteItem = {
  inviteId: string;
  email: string;
  role: string;
  roleLabel: string;
  invitedByName: string;
  expiresAt: string;
  createdAt: string;
  status: string;
};

export type TeamPageData = {
  kind: "ok";
  members: TeamMemberItem[];
  pendingInvites: PendingInviteItem[];
  canManageTeam: boolean;
  memberCount: number;
  organizationName: string;
  actorRole: string;
};

export type TeamPageResult =
  | TeamPageData
  | { kind: "no_organization" }
  | { kind: "error"; message: string };

type MemberRow = {
  membership_id: string;
  profile_id: string;
  full_name: string | null;
  job_title: string | null;
  email: string | null;
  role: string;
  joined_at: string;
};

type InviteRow = {
  invite_id: string;
  email: string;
  role: string;
  invited_by_name: string | null;
  expires_at: string;
  created_at: string;
  status: string;
};

function mapMember(row: MemberRow): TeamMemberItem {
  return {
    membershipId: row.membership_id,
    profileId: row.profile_id,
    fullName: row.full_name?.trim() || row.email || "Team member",
    jobTitle: row.job_title?.trim() || null,
    email: row.email ?? "",
    role: row.role,
    roleLabel: organizationRoleLabel(row.role),
    joinedAt: row.joined_at,
  };
}

function mapInvite(row: InviteRow): PendingInviteItem {
  return {
    inviteId: row.invite_id,
    email: row.email,
    role: row.role,
    roleLabel: organizationRoleLabel(row.role),
    invitedByName: row.invited_by_name?.trim() || "Team member",
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    status: row.status,
  };
}

export async function getTeamForActiveOrganization(): Promise<TeamPageResult> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { kind: "no_organization" };
  }

  const supabase = await createSupabaseServerClient();
  const membersPromise = supabase.rpc("list_organization_team_members", {
    p_organization_id: organization.id,
  });

  const invitesPromise = canManageTeam(organization.role)
    ? supabase.rpc("list_organization_pending_invites", {
        p_organization_id: organization.id,
      })
    : Promise.resolve({ data: [], error: null });

  const [membersResult, invitesResult] = await Promise.all([membersPromise, invitesPromise]);

  if (membersResult.error) {
    console.error("getTeamForActiveOrganization members failed", membersResult.error.message);
    return { kind: "error", message: "Could not load team members." };
  }

  if (invitesResult.error) {
    console.error("getTeamForActiveOrganization invites failed", invitesResult.error.message);
    return { kind: "error", message: "Could not load pending invitations." };
  }

  const members = ((membersResult.data ?? []) as MemberRow[]).map(mapMember);
  const pendingInvites = ((invitesResult.data ?? []) as InviteRow[])
    .map(mapInvite)
    .filter((invite) => invite.status === "pending" || invite.status === "expired");

  return {
    kind: "ok",
    members,
    pendingInvites,
    canManageTeam: canManageTeam(organization.role),
    memberCount: members.length,
    organizationName: organization.name,
    actorRole: organization.role,
  };
}
