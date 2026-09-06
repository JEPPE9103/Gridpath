"use client";

import { Button } from "@/components/ui/button";
import {
  updateNotificationSettingsAction,
  type NotificationSettingsState,
} from "@/lib/notifications/actions";
import type { NotificationSettings } from "@/lib/data/notification-settings";
import { useActionState } from "react";

export function NotificationSettingsSection({
  settings,
  canManage,
}: {
  settings: NotificationSettings;
  canManage: boolean;
}) {
  const [state, action] = useActionState(
    updateNotificationSettingsAction,
    {} as NotificationSettingsState,
  );

  return (
    <section className="max-w-xl rounded-md border border-line bg-surface p-5">
      <h2 className="text-base font-semibold">Email notifications</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        In-app alerts stay available regardless of email settings. Invitation emails are operational
        and are not controlled here. The sales demo workspace never sends these product emails.
      </p>
      {canManage ? (
        <form action={action} className="mt-4 space-y-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="digest_enabled"
              defaultChecked={settings.digestEnabled}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-ink">Weekly digest</span>
              <span className="block text-muted">
                Optional summary of open warning/critical alerts, overdue required items, and new
                geographically matched published changes.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="impact_email_enabled"
              defaultChecked={settings.impactEmailEnabled}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-ink">Important published-change email</span>
              <span className="block text-muted">
                Sent when a published official change is geographically matched to a project. It does
                not mean the project is at risk or that capacity is available.
              </span>
            </span>
          </label>
          <Button type="submit">Save email settings</Button>
          {state.error ? <p className="text-sm text-critical">{state.error}</p> : null}
          {state.success ? <p className="text-sm text-muted">{state.success}</p> : null}
        </form>
      ) : (
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Weekly digest</dt>
            <dd>{settings.digestEnabled ? "On" : "Off"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Important published-change email</dt>
            <dd>{settings.impactEmailEnabled ? "On" : "Off"}</dd>
          </div>
          <p className="text-xs text-muted">Ask an owner or admin to change email preferences.</p>
        </dl>
      )}
    </section>
  );
}
