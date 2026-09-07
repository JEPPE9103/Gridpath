"use client";

import { Tooltip } from "@/components/ui/tooltip";

const DEMO_TOOLTIP =
  "Sample customer-entered project and workflow data. Official Grid Intelligence is from Noxheim’s current official datasets — this workspace does not invent official GI. Product emails are disabled for the demo organisation.";

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
        {collapsed ? "Sample" : "Sample workspace"}
      </span>
    </Tooltip>
  );
}

export function DemoWorkspaceBanner() {
  return (
    <div className="border-b border-line bg-teal-soft px-4 py-2 sm:px-6 lg:px-8">
      <p className="text-xs text-ink">
        <Tooltip content={DEMO_TOOLTIP}>
          <span className="font-semibold">Sample workspace.</span>
        </Tooltip>{" "}
        <span className="text-muted">
          Customer-entered projects and workflow data here are sample. Official Grid Intelligence
          is from Noxheim’s current official datasets. Demo organisations do not receive product
          emails.
        </span>
      </p>
    </div>
  );
}
