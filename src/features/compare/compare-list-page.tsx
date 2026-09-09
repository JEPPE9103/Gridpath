"use client";

import { BellButton } from "@/components/layout/app-shell";
import { EmptyState, EmptyWorkspaceAction } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SavedComparisonsList } from "@/features/compare/saved-comparisons-list";
import { ClientHeaderDate } from "@/components/ui/client-header-date";
import type { SavedComparisonsResult } from "@/lib/data/portfolio-comparisons";
import Link from "next/link";

export function CompareListPage({ result }: { result: SavedComparisonsResult }) {
  if (result.kind === "no_organization") {
    return (
      <>
        <PageHeader title="Saved comparisons" subtitle="Shared portfolio compare" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="No workspace yet"
            description="Join a workspace to save and share comparisons."
            action={<EmptyWorkspaceAction />}
          />
        </div>
      </>
    );
  }

  if (result.kind === "error") {
    return (
      <>
        <PageHeader title="Saved comparisons" subtitle="Shared portfolio compare" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState title="Could not load saved comparisons" description={result.message} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Saved comparisons"
        subtitle="Shared with this workspace · Development Profile ranking only"
        actions={
          <>
            <BellButton />
            <ClientHeaderDate />
          </>
        }
      />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <p className="text-sm text-muted">
          Temporary compare lives in this browser on{" "}
          <Link href="/map" className="text-teal hover:text-teal-dark">
            Map & Compare
          </Link>
          . Saving a named comparison shares it with your team. This is not official grid
          intelligence or a capacity score.
        </p>
        {!result.canWrite ? (
          <p className="text-sm text-muted">Viewers can open saved comparisons but cannot change them.</p>
        ) : null}
        {result.comparisons.length === 0 ? (
          <EmptyState
            title="No saved comparisons"
            description="Select up to four projects on the map, then save a named comparison for the team."
            action={
              <Link href="/map" className="text-sm font-medium text-teal hover:underline">
                Open Map & Compare
              </Link>
            }
          />
        ) : (
          <SavedComparisonsList comparisons={result.comparisons} canWrite={result.canWrite} />
        )}
      </div>
    </>
  );
}
