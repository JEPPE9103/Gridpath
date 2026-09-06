"use client";

import { Button } from "@/components/ui/button";
import {
  deletePortfolioComparison,
  renamePortfolioComparison,
} from "@/lib/compare/actions";
import type { SavedComparisonSummary } from "@/lib/data/portfolio-comparisons";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SavedComparisonsList({
  comparisons,
  canWrite,
}: {
  comparisons: SavedComparisonSummary[];
  canWrite: boolean;
}) {
  if (comparisons.length === 0) {
    return (
      <p className="text-sm text-muted">
        No saved comparisons yet. Temporary compare stays in this browser until you save it for the
        team.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Projects</th>
            <th className="px-4 py-2 font-medium">Updated</th>
            <th className="px-4 py-2 font-medium">Created by</th>
            <th className="px-4 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {comparisons.map((item) => (
            <SavedComparisonRow key={item.id} item={item} canWrite={canWrite} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SavedComparisonRow({
  item,
  canWrite,
}: {
  item: SavedComparisonSummary;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(item.name);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-3">
        {renaming ? (
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-8 w-full rounded-md border border-line px-2 text-sm"
          />
        ) : (
          <Link href={`/compare/${item.id}`} className="font-medium hover:text-teal">
            {item.name}
          </Link>
        )}
        {item.hasArchivedProjects ? (
          <p className="mt-1 text-xs text-muted">Includes archived projects</p>
        ) : null}
      </td>
      <td className="px-4 py-3">{item.projectCount}</td>
      <td className="px-4 py-3 text-muted">{formatDate(item.updatedAt)}</td>
      <td className="px-4 py-3 text-muted">{item.createdByName ?? "—"}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <Link href={`/compare/${item.id}`}>
            <Button type="button" variant="secondary">
              Open
            </Button>
          </Link>
          {canWrite && renaming ? (
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await renamePortfolioComparison(item.id, name);
                  if (!result.ok) {
                    setMessage(result.error);
                    return;
                  }
                  setRenaming(false);
                  router.refresh();
                });
              }}
            >
              Save name
            </Button>
          ) : null}
          {canWrite && !renaming ? (
            <Button type="button" variant="secondary" onClick={() => setRenaming(true)}>
              Rename
            </Button>
          ) : null}
          {canWrite ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                if (!window.confirm(`Delete saved comparison “${item.name}”?`)) {
                  return;
                }
                startTransition(async () => {
                  const result = await deletePortfolioComparison(item.id);
                  if (!result.ok) {
                    setMessage(result.error ?? "Could not delete.");
                    return;
                  }
                  router.refresh();
                });
              }}
            >
              Delete
            </Button>
          ) : null}
        </div>
        {message ? <p className="mt-1 text-xs text-critical">{message}</p> : null}
      </td>
    </tr>
  );
}
