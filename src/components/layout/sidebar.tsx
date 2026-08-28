"use client";

import { CountBadge } from "@/components/ui/badges";
import { DemoWorkspaceChip } from "@/components/layout/demo-workspace-banner";
import { signOut } from "@/lib/auth/actions";
import type { CurrentUserProfile } from "@/lib/auth/current-user";
import { cn } from "@/lib/cn";
import {
  BarChart3,
  Briefcase,
  FileText,
  LayoutGrid,
  LogOut,
  Map,
  PanelLeft,
  Radio,
  Settings,
  X,
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
  onNavigate,
  overlay = false,
  user,
  criticalAlertCount = 0,
  isDemoWorkspace = false,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  overlay?: boolean;
  user: CurrentUserProfile | null;
  criticalAlertCount?: number;
  isDemoWorkspace?: boolean;
}) {
  const pathname = usePathname();

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
          {isDemoWorkspace ? (
            <div className="mt-2">
              <DemoWorkspaceChip />
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={overlay ? onNavigate : onToggle}
          className="rounded-md p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-white md:inline-flex"
          aria-label={overlay ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {overlay ? <X size={16} /> : <PanelLeft size={16} />}
        </button>
      </div>
      {collapsed && isDemoWorkspace ? (
        <div className="px-2 pt-2">
          <DemoWorkspaceChip collapsed />
        </div>
      ) : null}

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
              onClick={onNavigate}
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
                  {item.href === "/overview" && criticalAlertCount > 0 ? (
                    <CountBadge tone="critical">{criticalAlertCount}</CountBadge>
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
          onClick={onNavigate}
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
            {user?.initials ?? "?"}
          </div>
          {collapsed ? null : (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{user?.fullName ?? "Account"}</p>
              {user?.jobTitle ? (
                <p className="truncate text-[11px] text-sidebar-muted">{user.jobTitle}</p>
              ) : user?.email && user.email !== user.fullName ? (
                <p className="truncate text-[11px] text-sidebar-muted">{user.email}</p>
              ) : null}
            </div>
          )}
        </div>
        <form action={signOut} className={cn("mt-2", collapsed && "flex justify-center")}>
          <button
            type="submit"
            title="Sign out"
            className={cn(
              "rounded-md text-[11px] text-sidebar-muted hover:text-white",
              collapsed ? "p-1.5 hover:bg-sidebar" : "px-0 py-0.5",
            )}
          >
            {collapsed ? <LogOut size={14} strokeWidth={1.75} /> : "Sign out"}
          </button>
        </form>
      </div>
    </aside>
  );
}
