"use client";

import type { WorkspaceOption } from "@/components/layout/workspace-switcher";
import { DemoWorkspaceBanner } from "@/components/layout/demo-workspace-banner";
import { Sidebar } from "@/components/layout/sidebar";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ToastViewport } from "@/components/ui/toast-viewport";
import type { CurrentUserProfile } from "@/lib/auth/current-user";
import { WorkspaceProvider } from "@/lib/workspace-state";
import { Bell, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";

function subscribeSidebarCollapse(onStoreChange: () => void) {
  const mobile = window.matchMedia("(max-width: 767px)");
  const desktop = window.matchMedia("(min-width: 1280px)");
  mobile.addEventListener("change", onStoreChange);
  desktop.addEventListener("change", onStoreChange);
  return () => {
    mobile.removeEventListener("change", onStoreChange);
    desktop.removeEventListener("change", onStoreChange);
  };
}

function getSidebarCollapsePreference() {
  if (window.matchMedia("(max-width: 767px)").matches) {
    return false;
  }
  return !window.matchMedia("(min-width: 1280px)").matches;
}

function getSidebarMediaKey() {
  const mobile = window.matchMedia("(max-width: 767px)").matches;
  const desktop = window.matchMedia("(min-width: 1280px)").matches;
  return `${mobile ? "m" : "d"}:${desktop ? "xl" : "sm"}`;
}

const FALLBACK_WORKSPACE: WorkspaceOption = {
  id: "00000000-0000-4000-8000-000000000000",
  name: "Workspace",
  slug: "workspace",
  role: "viewer",
};

function ShellFrame({
  children,
  user,
  criticalAlertCount,
  isDemoWorkspace,
  activeOrganization,
  organizations,
}: {
  children: ReactNode;
  user: CurrentUserProfile | null;
  criticalAlertCount: number;
  isDemoWorkspace: boolean;
  activeOrganization?: WorkspaceOption;
  organizations?: WorkspaceOption[];
}) {
  const resolvedOrganization = activeOrganization ?? FALLBACK_WORKSPACE;
  const resolvedOrganizations = organizations ?? [];
  const pathname = usePathname();
  const mediaCollapsed = useSyncExternalStore(
    subscribeSidebarCollapse,
    getSidebarCollapsePreference,
    () => false,
  );
  const mediaKey = useSyncExternalStore(
    subscribeSidebarCollapse,
    getSidebarMediaKey,
    () => "ssr",
  );
  const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null);
  const [mediaKeySeen, setMediaKeySeen] = useState(mediaKey);
  if (mediaKeySeen !== mediaKey) {
    setMediaKeySeen(mediaKey);
    setManualCollapsed(null);
  }
  const sidebarCollapsed = manualCollapsed ?? mediaCollapsed;
  const [mobileNavPath, setMobileNavPath] = useState<string | null>(null);
  const mobileOpen = mobileNavPath === pathname;

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const closeMobileOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobileNavPath(null);
      }
    };
    desktop.addEventListener("change", closeMobileOnDesktop);
    return () => {
      desktop.removeEventListener("change", closeMobileOnDesktop);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-ink/45 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavPath(null)}
        />
      ) : null}

      <div
        className={
          mobileOpen
            ? "fixed inset-y-0 left-0 z-50 h-full md:relative md:z-auto"
            : "pointer-events-none invisible fixed inset-y-0 left-0 z-50 h-full -translate-x-full md:pointer-events-auto md:visible md:relative md:z-auto md:translate-x-0"
        }
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          overlay={mobileOpen}
          user={user}
          criticalAlertCount={criticalAlertCount}
          isDemoWorkspace={isDemoWorkspace}
          activeOrganization={resolvedOrganization}
          organizations={resolvedOrganizations}
          onToggle={() => setManualCollapsed(!sidebarCollapsed)}
          onNavigate={() => setMobileNavPath(null)}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        <div className="flex items-center gap-3 border-b border-line bg-sidebar px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-white md:hidden">
          <button
            type="button"
            className="rounded-md p-1.5 text-white hover:bg-sidebar-hover"
            aria-label="Open menu"
            onClick={() => setMobileNavPath(pathname)}
          >
            <Menu size={18} />
          </button>
          <p className="text-[13px] font-semibold tracking-[0.18em]">NOXHEIM</p>
          <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-teal text-[10px] font-semibold">
            {user?.initials ?? "?"}
          </span>
        </div>
        {isDemoWorkspace ? <DemoWorkspaceBanner /> : null}
        {children}
      </div>
    </div>
  );
}

export function AppShell({
  children,
  user = null,
  criticalAlertCount = 0,
  isDemoWorkspace = false,
  activeOrganization = FALLBACK_WORKSPACE,
  organizations = [],
}: {
  children: ReactNode;
  user?: CurrentUserProfile | null;
  criticalAlertCount?: number;
  isDemoWorkspace?: boolean;
  activeOrganization?: WorkspaceOption;
  organizations?: WorkspaceOption[];
}) {
  return (
    <ToastProvider>
      <WorkspaceProvider>
        <ShellFrame
          user={user}
          criticalAlertCount={criticalAlertCount}
          isDemoWorkspace={isDemoWorkspace}
          activeOrganization={activeOrganization}
          organizations={organizations}
        >
          {children}
        </ShellFrame>
        <ToastViewport />
      </WorkspaceProvider>
    </ToastProvider>
  );
}

export function BellButton() {
  return (
    <button
      type="button"
      className="rounded-md p-2 text-muted hover:bg-surface hover:text-ink"
      aria-label="Notifications"
    >
      <Bell size={16} strokeWidth={1.75} />
    </button>
  );
}
