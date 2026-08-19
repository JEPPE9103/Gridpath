"use client";

import { CountBadge } from "@/components/ui/badges";
import { cn } from "@/lib/cn";
import { alertRepository } from "@/lib/repositories";
import { useWorkspace } from "@/lib/workspace-state";
import {
  BarChart3,
  Briefcase,
  FileText,
  LayoutGrid,
  Map,
  PanelLeft,
  Radio,
  Settings,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/overview", label: "Overview", icon: LayoutGrid, match: ["/overview"] },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase, match: ["/portfolio", "/projects"] },
  { href: "/map", label: "Map & Compare", icon: Map, match: ["/map"] },
  { href: "/connections", label: "Connections", icon: Zap, match: ["/connections"] },
  { href: "/changes", label: "Changes", icon: Radio, match: ["/changes"] },
  { href: "/documents", label: "Documents", icon: FileText, match: ["/documents"] },
  { href: "/reports", label: "Reports", icon: BarChart3, match: ["/reports"] },
];

export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const { overlays } = useWorkspace();
  const criticalCount = alertRepository
    .list(overlays)
    .filter((alert) => alert.severity === "critical").length;

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col bg-sidebar text-white transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[232px]",
      )}
    >
      <div className={cn("flex items-start justify-between px-4 pt-6", collapsed && "px-3")}>
        <div className={cn(collapsed && "sr-only")}>
          <p className="text-[15px] font-semibold tracking-[0.18em]">NOXHEIM</p>
          <p className="mt-1 text-[11px] tracking-wide text-sidebar-muted">
            Grid Intelligence
          </p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeft size={16} />
        </button>
      </div>

      <p
        className={cn(
          "mt-8 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-muted",
          collapsed && "sr-only",
        )}
      >
        Workspace
      </p>

      <nav className="mt-2 flex-1 space-y-0.5 px-2">
        {NAV.map((item) => {
          const active = item.match.some(
            (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
          );
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                active
                  ? "bg-sidebar-hover text-white"
                  : "text-sidebar-muted hover:bg-sidebar-hover hover:text-white",
                collapsed && "justify-center px-2",
              )}
            >
              {active ? (
                <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r bg-teal" />
              ) : null}
              <Icon
                size={16}
                strokeWidth={1.75}
                className={cn(active ? "text-teal" : "text-current")}
              />
              {collapsed ? null : (
                <>
                  <span className={cn("flex-1", active && "text-white")}>{item.label}</span>
                  {item.href === "/overview" && criticalCount > 0 ? (
                    <CountBadge tone="critical">{criticalCount}</CountBadge>
                  ) : null}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="px-2 pb-2">
        <Link
          href="/settings"
          title="Settings"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] text-sidebar-muted hover:bg-sidebar-hover hover:text-white",
            pathname.startsWith("/settings") && "bg-sidebar-hover text-white",
            collapsed && "justify-center px-2",
          )}
        >
          <Settings size={16} strokeWidth={1.75} />
          {collapsed ? null : <span>Settings</span>}
        </Link>
      </div>

      <div className={cn("mx-2 mb-3 rounded-md bg-sidebar-hover px-3 py-3", collapsed && "px-2")}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal text-[11px] font-semibold">
            JP
          </div>
          {collapsed ? null : (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">Jesper Persson</p>
              <p className="truncate text-[11px] text-sidebar-muted">Portfolio Manager</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
