"use client";

import { BellButton } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileForm } from "@/features/settings/profile-form";
import { NotificationSettingsSection } from "@/features/settings/notification-settings-section";
import { SourceHealthSection } from "@/features/settings/source-health-section";
import { TeamSection } from "@/features/settings/team-section";
import type { CurrentUserProfile } from "@/lib/auth/current-user";
import { organizationRoleLabel } from "@/lib/data/organization-role";
import type { TeamPageResult } from "@/lib/data/team";
import type { SourceHealthView } from "@/lib/data/source-health";
import type { NotificationSettings } from "@/lib/data/notification-settings";
import { ClientHeaderDate } from "@/components/ui/client-header-date";
import { writeJson } from "@/lib/persistence";

export function SettingsPage({
  user,
  organization,
  team,
  inviteEmailConfigured,
  sourceHealth,
  notificationSettings,
  canManageNotifications,
}: {
  user: CurrentUserProfile;
  organization: { name: string; role: string } | null;
  team: TeamPageResult;
  inviteEmailConfigured: boolean;
  sourceHealth: SourceHealthView[];
  notificationSettings: NotificationSettings;
  canManageNotifications: boolean;
}) {
  return (
    <>
      <PageHeader
        title="Settings"
        eyebrow="Workspace"
        subtitle="Profile, organisation, notifications, and official source health"
        actions={
          <>
            <BellButton />
            <ClientHeaderDate />
          </>
        }
      />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <section className="max-w-xl rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Profile</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Email</dt>
              <dd className="text-right">{user.email || "—"}</dd>
            </div>
          </dl>
          <ProfileForm fullName={user.fullName} jobTitle={user.jobTitle} />
        </section>
        <section className="max-w-xl rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Organization</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Organization</dt>
              <dd className="text-right">{organization?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Your role</dt>
              <dd className="text-right">
                {organization ? organizationRoleLabel(organization.role) : "—"}
              </dd>
            </div>
            {team.kind === "ok" ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Members</dt>
                <dd className="text-right">{team.memberCount}</dd>
              </div>
            ) : null}
          </dl>
        </section>
        {team.kind === "ok" ? (
          <TeamSection
            members={team.members}
            pendingInvites={team.pendingInvites}
            canManageTeam={team.canManageTeam}
            memberCount={team.memberCount}
            organizationName={team.organizationName}
            actorRole={team.actorRole}
            currentUserId={user.id}
            inviteEmailConfigured={inviteEmailConfigured}
          />
        ) : team.kind === "error" ? (
          <section className="max-w-xl rounded-md border border-line bg-surface p-5">
            <p className="text-sm text-muted">{team.message}</p>
          </section>
        ) : null}
        <NotificationSettingsSection
          settings={notificationSettings}
          canManage={canManageNotifications}
        />
        <SourceHealthSection sources={sourceHealth} />
        <section className="max-w-xl rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Browser preferences</h2>
          <p className="mt-2 text-sm text-muted">
            Map &amp; Compare temporary selections are saved in this browser only. Named
            comparisons saved from Compare are shared with your workspace.
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => {
              writeJson("compareIds", []);
              window.location.reload();
            }}
          >
            Clear compare selection
          </Button>
        </section>
      </div>
    </>
  );
}
