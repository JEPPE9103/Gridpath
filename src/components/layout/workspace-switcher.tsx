"use client";

import { switchActiveOrganization } from "@/lib/organization/switch-workspace";
import { cn } from "@/lib/cn";
import { Check, ChevronDown } from "lucide-react";
import { useState, useTransition } from "react";

export type WorkspaceOption = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export function WorkspaceSwitcher({
  activeOrganization,
  organizations,
  collapsed = false,
}: {
  activeOrganization: WorkspaceOption;
  organizations: WorkspaceOption[];
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const canSwitch = organizations.length > 1;

  if (!canSwitch) {
    return (
      <p className={cn("mt-2 text-[12px] font-medium text-white/90", collapsed && "sr-only")}>
        {activeOrganization.name}
      </p>
    );
  }

  return (
    <div className={cn("relative mt-2", collapsed && "px-1")}>
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center gap-1 rounded-md px-1 py-1 text-left text-[12px] font-medium text-white/90 hover:bg-sidebar-hover",
          collapsed && "justify-center px-0",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={cn("min-w-0 flex-1 truncate", collapsed && "sr-only")}>
          {activeOrganization.name}
        </span>
        {collapsed ? (
          <span className="text-[10px] font-semibold text-teal" title={activeOrganization.name}>
            {activeOrganization.name.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <ChevronDown size={14} className="shrink-0 text-sidebar-muted" />
        )}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close workspace menu"
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "absolute top-full z-50 mt-1 min-w-[200px] rounded-md border border-white/10 bg-sidebar p-1 shadow-lg",
              collapsed ? "left-full ml-2" : "left-0 w-full",
            )}
            role="listbox"
            aria-label="Switch workspace"
          >
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
              Switch workspace
            </p>
            {organizations.map((organization) => {
              const active = organization.id === activeOrganization.id;
              return (
                <button
                  key={organization.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={pending || active}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-sidebar-hover",
                    active ? "text-white" : "text-sidebar-muted hover:text-white",
                  )}
                  onClick={() => {
                    setOpen(false);
                    startTransition(async () => {
                      await switchActiveOrganization(organization.id);
                    });
                  }}
                >
                  <span className="min-w-0 flex-1 truncate">{organization.name}</span>
                  {active ? <Check size={14} className="shrink-0 text-teal" /> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
