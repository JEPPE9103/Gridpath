"use client";

import { BellButton } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatHeaderDate } from "@/lib/format";
import { writeJson } from "@/lib/persistence";

export function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Workspace preferences for this demo"
        actions={
          <>
            <BellButton />
            <span className="hidden text-sm text-muted sm:inline">{formatHeaderDate("2026-08-18")}</span>
          </>
        }
      />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <section className="max-w-xl rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Portfolio</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Name</dt>
              <dd>Sweden portfolio</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Owner</dt>
              <dd>Jesper Persson</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Role</dt>
              <dd>Portfolio Manager</dd>
            </div>
          </dl>
        </section>
        <section className="max-w-xl rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Demo data</h2>
          <p className="mt-2 text-sm text-muted">
            Dismissed alerts, checklist updates, documents and compare selections are stored in
            this browser only.
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => {
              writeJson("overlays", {
                dismissedAlertIds: [],
                readinessOverrides: {},
                extraDocuments: [],
                documentStatusOverrides: {},
              });
              writeJson("compareIds", []);
              window.location.reload();
            }}
          >
            Reset local demo state
          </Button>
        </section>
      </div>
    </>
  );
}
