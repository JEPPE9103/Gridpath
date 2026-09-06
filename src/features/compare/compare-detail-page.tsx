"use client";

import { BellButton } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DevelopmentCompareTable } from "@/features/compare/development-compare-table";
import {
  deletePortfolioComparison,
  renamePortfolioComparison,
  updatePortfolioComparisonFromSlugs,
} from "@/lib/compare/actions";
import type { SavedComparisonDetailResult } from "@/lib/data/portfolio-comparisons";
import { ClientHeaderDate } from "@/components/ui/client-header-date";
import { useWorkspace } from "@/lib/workspace-state";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function CompareDetailPage({ result }: { result: SavedComparisonDetailResult }) {
  if (result.kind === "no_organization") {
    return (
      <>
        <PageHeader title="Saved comparison" subtitle="Shared portfolio compare" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="No workspace yet"
            description="Join a workspace to open saved comparisons."
          />
        </div>
      </>
    );
  }

  if (result.kind === "not_found") {
    return (
      <>
        <PageHeader title="Saved comparison" subtitle="Shared portfolio compare" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="Comparison not found"
            description="This comparison is not in your workspace, or it was deleted."
          />
        </div>
      </>
    );
  }

  if (result.kind === "error") {
    return (
      <>
        <PageHeader title="Saved comparison" subtitle="Shared portfolio compare" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState title="Could not load comparison" description={result.message} />
        </div>
      </>
    );
  }

  return <LoadedCompareDetail comparison={result.comparison} />;
}

function LoadedCompareDetail({
  comparison,
}: {
  comparison: Extract<SavedComparisonDetailResult, { kind: "ok" }>["comparison"];
}) {
  const router = useRouter();
  const { compareIds, setCompareIds } = useWorkspace();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(comparison.name);
  const [message, setMessage] = useState<string | null>(null);

  const archivedCount = comparison.projects.filter((project) => project.archivedAt).length;

  return (
    <>
      <PageHeader
        title={comparison.name}
        subtitle="Shared team comparison · Development Profile ranking, not a capacity or feasibility score"
        actions={
          <>
            <BellButton />
            <ClientHeaderDate />
          </>
        }
      />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <p className="text-sm text-muted">
          This saved comparison is shared with members of this workspace. Temporary compare in Map
          stays in this browser only until you save it.
        </p>
        {archivedCount > 0 ? (
          <p className="text-sm text-muted">
            {archivedCount === 1 ? "One project is archived" : `${archivedCount} projects are archived`}{" "}
            and kept here for history. Archived projects cannot be newly added.
          </p>
        ) : null}

        {comparison.canWrite ? (
          <div className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface p-4">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-9 w-64 rounded-md border border-line px-3"
              />
            </label>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await renamePortfolioComparison(comparison.id, name);
                  setMessage(result.ok ? "Name updated." : result.error);
                  if (result.ok) {
                    router.refresh();
                  }
                });
              }}
            >
              Rename
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending || compareIds.length === 0}
              onClick={() => {
                startTransition(async () => {
                  const result = await updatePortfolioComparisonFromSlugs(
                    comparison.id,
                    compareIds,
                  );
                  setMessage(
                    result.ok
                      ? "Updated from this browser’s temporary compare."
                      : result.error,
                  );
                  if (result.ok) {
                    router.refresh();
                  }
                });
              }}
            >
              Replace with this browser’s temporary compare
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCompareIds(comparison.projects.map((project) => project.slug));
                setMessage("Copied into this browser’s temporary compare.");
              }}
            >
              Copy to this browser
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`Delete saved comparison “${comparison.name}”?`)) {
                  return;
                }
                startTransition(async () => {
                  const result = await deletePortfolioComparison(comparison.id);
                  if (!result.ok) {
                    setMessage(result.error ?? "Could not delete.");
                    return;
                  }
                  router.push("/compare");
                });
              }}
            >
              Delete
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">Viewers can open saved comparisons but cannot change them.</p>
        )}
        {message ? <p className="text-sm text-muted">{message}</p> : null}
        <DevelopmentCompareTable projects={comparison.projects} />
      </div>
    </>
  );
}
