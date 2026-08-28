"use client";

import { Tooltip } from "@/components/ui/tooltip";

const DEMO_TOOLTIP =
  "Project and workflow data in this workspace is sample data. Official Grid Intelligence is sourced from NOXHEIM's current official datasets.";

export function DemoWorkspaceChip({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Tooltip content={DEMO_TOOLTIP}>
      <span
        className={
          collapsed
            ? "inline-flex h-6 w-8 items-center justify-center rounded-sm border border-teal/40 bg-teal/15 text-[9px] font-semibold uppercase tracking-wide text-teal"
            : "inline-flex rounded-sm border border-teal/40 bg-teal/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal"
        }
      >
        {collapsed ? "Demo" : "Demo workspace"}
      </span>
    </Tooltip>
  );
}

export function DemoWorkspaceBanner() {
  return (
    <div className="border-b border-line bg-teal-soft px-4 py-2 sm:px-6 lg:px-8">
      <Tooltip content={DEMO_TOOLTIP}>
        <p className="text-xs text-ink">
          <span className="font-semibold">Demo workspace.</span>{" "}
          <span className="text-muted">
            Sample project and workflow data. Official Grid Intelligence is from NOXHEIM’s current
            official datasets.
          </span>
        </p>
      </Tooltip>
    </div>
  );
}
