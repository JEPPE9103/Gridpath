import { logError } from "@/lib/observability/log";

export type InviteEmailSendResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "provider_rejected" };

export function getInviteEmailConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.INVITE_FROM_EMAIL?.trim() ?? "";
  if (!apiKey || !from) {
    return null;
  }
  return { apiKey, from };
}

export function isInviteEmailConfigured(): boolean {
  return getInviteEmailConfig() !== null;
}

export function inviteCreatedMessage(delivery: InviteEmailSendResult): string {
  if (delivery.sent) {
    return "Invitation email sent. You can also copy the invite link.";
  }
  if (delivery.reason === "provider_rejected") {
    return "Invitation created, but the email provider did not accept it. Copy the invite link.";
  }
  return "Invitation created. Email delivery is not configured. Copy the invite link.";
}

export function inviteResentMessage(delivery: InviteEmailSendResult): string {
  if (delivery.sent) {
    return "Invitation email sent. A new invite link is ready to copy.";
  }
  if (delivery.reason === "provider_rejected") {
    return "Invitation updated, but the email provider did not accept it. Copy the new invite link.";
  }
  return "Invitation updated. Email delivery is not configured. Copy the new invite link.";
}

export async function sendOrganizationInviteEmail(input: {
  to: string;
  organizationName: string;
  inviteUrl: string;
  roleLabel: string;
}): Promise<InviteEmailSendResult> {
  const config = getInviteEmailConfig();
  if (!config) {
    return { sent: false, reason: "not_configured" };
  }

  const subject = `Invitation to ${input.organizationName} on NOXHEIM`;
  const text = [
    `You have been invited to join ${input.organizationName} as ${input.roleLabel}.`,
    "",
    `Open this link to accept: ${input.inviteUrl}`,
    "",
    "If you were not expecting this invitation, you can ignore it.",
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        subject,
        text,
      }),
    });
    if (!response.ok) {
      logError("email.invite.rejected", { status: response.status });
      return { sent: false, reason: "provider_rejected" };
    }
    return { sent: true };
  } catch (error) {
    logError("email.invite.failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { sent: false, reason: "provider_rejected" };
  }
}
