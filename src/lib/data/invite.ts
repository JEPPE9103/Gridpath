import { hashInviteToken } from "@/lib/organization/invite-token";
import { organizationRoleLabel } from "@/lib/data/organization-role";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InvitePreview = {
  organizationName: string;
  inviteRole: string;
  inviteRoleLabel: string;
  inviteEmail: string;
  expiresAt: string;
  status: "pending" | "accepted" | "revoked" | "expired";
};

export type InvitePreviewResult =
  | { kind: "ok"; preview: InvitePreview }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

type PreviewRow = {
  organization_name: string;
  invite_role: string;
  invite_email: string;
  expires_at: string;
  status: string;
};

export async function getOrganizationInvitePreview(
  rawToken: string,
): Promise<InvitePreviewResult> {
  if (!rawToken.trim()) {
    return { kind: "not_found" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_organization_invite_preview", {
    p_token_hash: hashInviteToken(rawToken),
  });

  if (error) {
    console.error("getOrganizationInvitePreview failed", error.message);
    return { kind: "error", message: "Could not load this invitation." };
  }

  const row = (Array.isArray(data) ? data[0] : data) as PreviewRow | undefined;
  if (!row) {
    return { kind: "not_found" };
  }

  const status = row.status as InvitePreview["status"];
  if (
    status !== "pending" &&
    status !== "accepted" &&
    status !== "revoked" &&
    status !== "expired"
  ) {
    return { kind: "not_found" };
  }

  return {
    kind: "ok",
    preview: {
      organizationName: row.organization_name,
      inviteRole: row.invite_role,
      inviteRoleLabel: organizationRoleLabel(row.invite_role),
      inviteEmail: row.invite_email,
      expiresAt: row.expires_at,
      status,
    },
  };
}
