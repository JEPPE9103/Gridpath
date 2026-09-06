import { SALES_DEMO_ORGANIZATION_ID } from "@/lib/demo/sales-demo";
import { sanitizeIngestError } from "@/lib/monitor/errors";
import {
  impactEmailSubject,
  impactEmailText,
  isDigestEmpty,
  weeklyDigestSubject,
  weeklyDigestText,
} from "@/lib/notifications/copy";
import { sendNotificationEmail } from "@/lib/notifications/resend";
import { logError, logEvent } from "@/lib/observability/log";
import { getPublicSiteUrl } from "@/lib/site-url";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type ImpactEmailRow = {
  organization_id: string;
  organization_name: string;
  alert_id: string;
  project_name: string | null;
  title: string;
  source_name: string | null;
  detected_at: string;
  recipient_emails: string[] | null;
};

type DigestRow = {
  organization_id: string;
  organization_name: string;
  period_key: string;
  recipient_emails: string[] | null;
  active_project_count: number;
  attention_project_count: number;
  new_impact_count: number;
  overdue_required_count: number;
  approaching_deadline_count: number;
  added_project_count: number;
  archived_project_count: number;
};

export async function runDailyMonitor() {
  const supabase = createSupabaseServiceClient();

  const { data: reconcile, error: reconcileError } = await supabase.rpc(
    "monitor_reconcile_workflow_alerts",
  );
  if (reconcileError) {
    logError("monitor.reconcile.failed", {
      message: sanitizeIngestError(reconcileError.message),
    });
    throw new Error("Workflow alert reconciliation failed.");
  }
  logEvent("monitor.reconcile.ok", { result: reconcile });

  const emails = await sendUndeliveredImpactEmails(supabase);
  return {
    reconcile,
    impactEmails: emails,
  };
}

export async function runWeeklyMonitor() {
  const supabase = createSupabaseServiceClient();
  return sendWeeklyDigests(supabase);
}

async function sendUndeliveredImpactEmails(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
) {
  const { data, error } = await supabase.rpc("monitor_list_undelivered_impact_emails");
  if (error) {
    logError("monitor.impact_email.list_failed", { message: sanitizeIngestError(error.message) });
    throw new Error("Could not list impact emails.");
  }
  const rows = (data ?? []) as ImpactEmailRow[];
  const appUrl = getPublicSiteUrl();
  let accepted = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.organization_id === SALES_DEMO_ORGANIZATION_ID) {
      skipped += 1;
      continue;
    }
    const recipients = (row.recipient_emails ?? []).filter(Boolean);
    if (recipients.length === 0) {
      skipped += 1;
      continue;
    }
    const { data: deliveryId, error: claimError } = await supabase.rpc(
      "monitor_claim_notification_delivery",
      {
        p_organization_id: row.organization_id,
        p_kind: "impact_email",
        p_period_key: `alert:${row.alert_id}`,
        p_alert_id: row.alert_id,
        p_recipient_count: recipients.length,
      },
    );
    if (claimError || !deliveryId) {
      skipped += 1;
      continue;
    }

    const projectName = row.project_name?.trim() || "a project";
    const send = await sendNotificationEmail({
      to: recipients,
      subject: impactEmailSubject(projectName),
      text: impactEmailText({
        projectName,
        sourceName: row.source_name?.trim() || "Official source",
        detectedAtLabel: new Date(row.detected_at).toISOString().slice(0, 10),
        appUrl,
      }),
    });

    if (send.accepted) {
      await supabase.rpc("monitor_finish_notification_delivery", {
        p_delivery_id: deliveryId,
        p_status: "accepted",
        p_provider_message_id: send.messageId ?? null,
      });
      accepted += 1;
    } else {
      await supabase.rpc("monitor_finish_notification_delivery", {
        p_delivery_id: deliveryId,
        p_status: "failed",
        p_error_code: send.reason,
      });
      logError("monitor.impact_email.send_failed", {
        reason: send.reason,
        organizationId: row.organization_id,
      });
      failed += 1;
    }
  }

  logEvent("monitor.impact_email.done", { accepted, failed, skipped, listed: rows.length });
  return { accepted, failed, skipped, listed: rows.length };
}

async function sendWeeklyDigests(supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data, error } = await supabase.rpc("monitor_list_weekly_digests");
  if (error) {
    logError("monitor.digest.list_failed", { message: sanitizeIngestError(error.message) });
    throw new Error("Could not list weekly digests.");
  }
  const rows = (data ?? []) as DigestRow[];
  const appUrl = getPublicSiteUrl();
  let accepted = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.organization_id === SALES_DEMO_ORGANIZATION_ID) {
      skipped += 1;
      continue;
    }
    const payload = {
      organizationName: row.organization_name,
      periodKey: row.period_key,
      activeProjectCount: row.active_project_count,
      attentionProjectCount: row.attention_project_count,
      newImpactCount: row.new_impact_count,
      overdueRequiredCount: row.overdue_required_count,
      approachingDeadlineCount: row.approaching_deadline_count,
      addedProjectCount: row.added_project_count,
      archivedProjectCount: row.archived_project_count,
    };
    if (isDigestEmpty(payload)) {
      skipped += 1;
      continue;
    }
    const recipients = (row.recipient_emails ?? []).filter(Boolean);
    if (recipients.length === 0) {
      skipped += 1;
      continue;
    }
    const { data: deliveryId, error: claimError } = await supabase.rpc(
      "monitor_claim_notification_delivery",
      {
        p_organization_id: row.organization_id,
        p_kind: "weekly_digest",
        p_period_key: row.period_key,
        p_recipient_count: recipients.length,
      },
    );
    if (claimError || !deliveryId) {
      skipped += 1;
      continue;
    }
    const send = await sendNotificationEmail({
      to: recipients,
      subject: weeklyDigestSubject(row.organization_name),
      text: weeklyDigestText(payload, appUrl),
    });
    if (send.accepted) {
      await supabase.rpc("monitor_finish_notification_delivery", {
        p_delivery_id: deliveryId,
        p_status: "accepted",
        p_provider_message_id: send.messageId ?? null,
      });
      accepted += 1;
    } else {
      await supabase.rpc("monitor_finish_notification_delivery", {
        p_delivery_id: deliveryId,
        p_status: "failed",
        p_error_code: send.reason,
      });
      logError("monitor.digest.send_failed", {
        reason: send.reason,
        organizationId: row.organization_id,
      });
      failed += 1;
    }
  }

  logEvent("monitor.digest.done", { accepted, failed, skipped, listed: rows.length });
  return { accepted, failed, skipped, listed: rows.length };
}
