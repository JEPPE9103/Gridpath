"use server";

import { getCurrentOrganization } from "@/lib/data/organization";
import { generateInviteToken } from "@/lib/organization/invite-token";
import {
  canAssignMemberRole,
  canInviteRole,
  canManageTargetMember,
  canManageTeam,
  isOrganizationRole,
  isValidInviteEmail,
  normalizeInviteEmail,
} from "@/lib/organization/team-permissions";
import { getPublicSiteUrl } from "@/lib/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type TeamActionState = {
  error?: string;
  success?: string;
  inviteUrl?: string;
};

function mapTeamError(message: string | undefined, fallback: string): string {
  const text = (message ?? "").toLowerCase();
  if (text.includes("already a member")) {
    return "This person is already a member of this workspace.";
  }
  if (text.includes("invite already pending")) {
    return "An invitation is already pending for this email.";
  }
  if (text.includes("invalid email")) {
    return "Enter a valid work email.";
  }
  if (text.includes("not allowed") || text.includes("42501")) {
    return "You do not have permission to do that.";
  }
  if (text.includes("last owner")) {
    return "Add another owner before changing this role or removing this member.";
  }
  if (text.includes("cannot change own role")) {
    return "You cannot change your own role here.";
  }
  if (text.includes("cannot remove self")) {
    return "You cannot remove yourself here.";
  }
  if (text.includes("member not found")) {
    return "Could not update that team member.";
  }
  if (text.includes("invite not active") || text.includes("invite not found")) {
    return "Could not revoke that invitation.";
  }
  return fallback;
}

export async function createOrganizationInviteAction(
  _previous: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const organization = await getCurrentOrganization();
  if (!organization || !canManageTeam(organization.role)) {
    return { error: "You do not have permission to invite teammates." };
  }

  const email = normalizeInviteEmail(String(formData.get("email") ?? ""));
  const role = String(formData.get("role") ?? "").trim();

  if (!isValidInviteEmail(email)) {
    return { error: "Enter a valid work email." };
  }
  if (!isOrganizationRole(role)) {
    return { error: "Select a valid role." };
  }
  if (!canInviteRole(organization.role, role)) {
    return { error: "You do not have permission to invite that role." };
  }

  const { rawToken, tokenHash } = generateInviteToken();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_organization_invite", {
    p_organization_id: organization.id,
    p_email: email,
    p_role: role,
    p_token_hash: tokenHash,
  });

  if (error || !data) {
    console.error("createOrganizationInviteAction failed", error?.message);
    return {
      error: mapTeamError(error?.message, "Could not create the invitation."),
    };
  }

  revalidatePath("/settings");
  return {
    success: "Invitation created.",
    inviteUrl: `${getPublicSiteUrl()}/invite/${encodeURIComponent(rawToken)}`,
  };
}

export async function revokeOrganizationInviteAction(
  inviteId: string,
): Promise<TeamActionState> {
  const organization = await getCurrentOrganization();
  if (!organization || !canManageTeam(organization.role)) {
    return { error: "You do not have permission to revoke invitations." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("revoke_organization_invite", {
    p_invite_id: inviteId,
  });

  if (error) {
    console.error("revokeOrganizationInviteAction failed", error.message);
    return { error: mapTeamError(error.message, "Could not revoke the invitation.") };
  }

  revalidatePath("/settings");
  return { success: "Invitation revoked." };
}

export async function changeOrganizationMemberRoleAction(
  profileId: string,
  newRole: string,
): Promise<TeamActionState> {
  const organization = await getCurrentOrganization();
  if (!organization || !canManageTeam(organization.role)) {
    return { error: "You do not have permission to change roles." };
  }
  if (!isOrganizationRole(newRole)) {
    return { error: "Select a valid role." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: memberRows, error: loadError } = await supabase.rpc(
    "list_organization_team_members",
    { p_organization_id: organization.id },
  );

  if (loadError) {
    console.error("changeOrganizationMemberRoleAction load failed", loadError.message);
    return { error: "Could not change the role." };
  }

  const target = (memberRows ?? []).find(
    (row: { profile_id: string; role: string }) => row.profile_id === profileId,
  );
  if (!target) {
    return { error: "Could not change the role." };
  }

  if (!canManageTargetMember(organization.role, target.role)) {
    return { error: "You do not have permission to change that member's role." };
  }
  if (!canAssignMemberRole(organization.role, target.role, newRole)) {
    return { error: "You do not have permission to assign that role." };
  }

  const { error } = await supabase.rpc("change_organization_member_role", {
    p_organization_id: organization.id,
    p_profile_id: profileId,
    p_new_role: newRole,
  });

  if (error) {
    console.error("changeOrganizationMemberRoleAction failed", error.message);
    return { error: mapTeamError(error.message, "Could not change the role.") };
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: "Role updated." };
}

export async function removeOrganizationMemberAction(
  profileId: string,
): Promise<TeamActionState> {
  const organization = await getCurrentOrganization();
  if (!organization || !canManageTeam(organization.role)) {
    return { error: "You do not have permission to remove members." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: memberRows, error: loadError } = await supabase.rpc(
    "list_organization_team_members",
    { p_organization_id: organization.id },
  );

  if (loadError) {
    console.error("removeOrganizationMemberAction load failed", loadError.message);
    return { error: "Could not remove the member." };
  }

  const target = (memberRows ?? []).find(
    (row: { profile_id: string; role: string }) => row.profile_id === profileId,
  );
  if (!target) {
    return { error: "Could not remove the member." };
  }

  if (!canManageTargetMember(organization.role, target.role)) {
    return { error: "You do not have permission to remove that member." };
  }

  const { error } = await supabase.rpc("remove_organization_member", {
    p_organization_id: organization.id,
    p_profile_id: profileId,
  });

  if (error) {
    console.error("removeOrganizationMemberAction failed", error.message);
    return { error: mapTeamError(error.message, "Could not remove the member.") };
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: "Member removed." };
}
