"use client";

import { BellButton } from "@/components/layout/app-shell";
import { CountBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { formatHeaderDate, formatRelative } from "@/lib/format";
import { changeRepository, projectRepository } from "@/lib/repositories";
import { useWorkspace } from "@/lib/workspace-state";
import { CHANGE_TYPES, type ChangeType } from "@/types";
import Link from "next/link";
import { useMemo, useState } from "react";

export function ChangesPage() {
  const { overlays } = useWorkspace();
  const projects = useMemo(() => projectRepository.list(overlays), [overlays]);
  const changes = changeRepository.list();
  const [type, setType] = useState<ChangeType | "All">("All");

  const filtered = changes.filter((change) => type === "All" || change.type === type);

  return (
    <>
      <PageHeader
        title="Changes"
        subtitle="External grid and operator updates mapped onto the portfolio"
        actions={
          <>
            <BellButton />
            <span className="hidden text-sm text-muted sm:inline">{formatHeaderDate("2026-08-18")}</span>
          </>
        }
      />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        <div className="flex flex-wrap gap-1.5">
          {(["All", ...CHANGE_TYPES] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setType(item)}
              className={cn(
                "rounded-full px-3 py-1 text-sm",
                type === item ? "bg-ink text-white" : "border border-line bg-surface text-muted hover:text-ink",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No changes in this category"
            description="Try another filter to see capacity, reinforcement, requirement and deadline updates."
          />
        ) : (
          <ol className="space-y-3">
            {filtered.map((change) => {
              const affected = change.affectedProjectIds
                .map((id) => projects.find((project) => project.id === id))
                .filter(Boolean);
              return (
                <li key={change.id} className="rounded-md border border-line bg-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted">{change.type}</p>
                      <h2 className="mt-1 text-base font-semibold">{change.title}</h2>
                    </div>
                    <div className="text-right text-xs text-muted">
                      <p>{change.source}</p>
                      <p className="mt-1">{formatRelative(change.detectedAt)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink/90">{change.summary}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <CountBadge tone="teal">
                      This change affects {affected.length}{" "}
                      {affected.length === 1 ? "project" : "projects"}
                    </CountBadge>
                    {affected.map((project) =>
                      project ? (
                        <Link
                          key={project.id}
                          href={`/projects/${project.id}?tab=grid`}
                          className="rounded-full bg-canvas px-2.5 py-0.5 text-sm hover:bg-teal-soft hover:text-teal"
                        >
                          {project.name}
                        </Link>
                      ) : null,
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </>
  );
}
