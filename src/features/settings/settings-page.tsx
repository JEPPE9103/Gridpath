"use client";

import { BellButton } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileForm } from "@/features/settings/profile-form";
import type { CurrentUserProfile } from "@/lib/auth/current-user";
import { organizationRoleLabel } from "@/lib/data/organization-role";
import { ClientHeaderDate } from "@/components/ui/client-header-date";
import { writeJson } from "@/lib/persistence";

export function SettingsPage({
  user,
  organization,
}: {
  user: CurrentUserProfile;
  organization: { name: string; role: string } | null;
}) {
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Your profile and workspace"
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
          <h2 className="text-base font-semibold">Workspace</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Organization</dt>
              <dd className="text-right">{organization?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Role</dt>
              <dd className="text-right">
                {organization ? organizationRoleLabel(organization.role) : "—"}
              </dd>
            </div>
          </dl>
        </section>
        <section className="max-w-xl rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Browser preferences</h2>
          <p className="mt-2 text-sm text-muted">
            Map &amp; Compare selections are saved in this browser only. They are not shared with
            your team and do not change organization data.
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
