import { logError } from "@/lib/observability/log";

export type NotificationSendResult =
  | { accepted: true; messageId: string | null }
  | { accepted: false; reason: "not_configured" | "provider_rejected" };

export function getNotificationEmailConfig(): { apiKey: string; from: string } | null {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from =
    process.env.NOTIFICATION_FROM_EMAIL?.trim() || process.env.INVITE_FROM_EMAIL?.trim() || "";
  if (!apiKey || !from) {
    return null;
  }
  return { apiKey, from };
}

export async function sendNotificationEmail(input: {
  to: string[];
  subject: string;
  text: string;
}): Promise<NotificationSendResult> {
  const config = getNotificationEmailConfig();
  if (!config) {
    return { accepted: false, reason: "not_configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
      }),
    });
    if (!response.ok) {
      logError("email.notification.rejected", { status: response.status });
      return { accepted: false, reason: "provider_rejected" };
    }
    let messageId: string | null = null;
    try {
      const body = (await response.json()) as { id?: string };
      messageId = typeof body.id === "string" ? body.id : null;
    } catch {
      messageId = null;
    }
    return { accepted: true, messageId };
  } catch (error) {
    logError("email.notification.failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return { accepted: false, reason: "provider_rejected" };
  }
}
