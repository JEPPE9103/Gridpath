"use server";

import { writeActiveOrganizationCookie } from "@/lib/organization/active-org-cookie";
import { hashInviteToken } from "@/lib/organization/invite-token";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type AcceptInviteState = {
  error?: string;
};

type AcceptRow = {
  organization_id: string;
  organization_name: string;
  invite_role: string;
};

function mapAcceptError(message: string | undefined): string {
  const text = (message ?? "").toLowerCase();
  if (text.includes("email confirmation required")) {
    return "Confirm your email before accepting this invitation.";
  }
  if (text.includes("invite email mismatch")) {
    return "This invitation was sent to another email address.";
  }
  if (text.includes("invite expired")) {
    return "This invitation has expired.";
  }
  if (text.includes("invite revoked")) {
    return "This invitation is no longer active.";
  }
  if (text.includes("invite already accepted")) {
    return "This invitation has already been used.";
  }
  if (text.includes("invite not found")) {
    return "This invitation is not valid.";
  }
  if (text.includes("not authenticated")) {
    return "Sign in to accept this invitation.";
  }
  return "Could not accept this invitation.";
}

export async function acceptOrganizationInviteAction(
  rawToken: string,
): Promise<AcceptInviteState> {
  if (!rawToken.trim()) {
    return { error: "This invitation is not valid." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Sign in to accept this invitation." };
  }

  const { data, error } = await supabase.rpc("accept_organization_invite", {
    p_token_hash: hashInviteToken(rawToken),
  });

  if (error || !data) {
    console.error("acceptOrganizationInviteAction failed", error?.message);
    return { error: mapAcceptError(error?.message) };
  }

  const row = (Array.isArray(data) ? data[0] : data) as AcceptRow | undefined;
  if (!row?.organization_id) {
    return { error: "Could not accept this invitation." };
  }

  await writeActiveOrganizationCookie(row.organization_id);
  revalidatePath("/", "layout");
  redirect("/overview");
}

export async function acceptOrganizationInviteFormAction(
  rawToken: string,
  _previous: AcceptInviteState,
  _formData: FormData,
): Promise<AcceptInviteState> {
  return acceptOrganizationInviteAction(rawToken);
}

export async function getAuthenticatedUserEmail(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email?.trim().toLowerCase() ?? null;
}
