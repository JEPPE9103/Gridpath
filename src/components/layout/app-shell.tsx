"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ToastViewport } from "@/components/ui/toast-viewport";
import type { CurrentUserProfile } from "@/lib/auth/current-user";
import { WorkspaceProvider } from "@/lib/workspace-state";
import { Bell, Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

function ShellFrame({
  children,
  user,
  criticalAlertCount,
}: {
  children: ReactNode;
  user: CurrentUserProfile | null;
  criticalAlertCount: number;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    const desktop = window.matchMedia("(min-width: 1280px)");
    const apply = () => {
      if (mobile.matches) {
        setCollapsed(false);
        return;
      }
      setCollapsed(!desktop.matches);
      setMobileOpen(false);
    };
    apply();
    mobile.addEventListener("change", apply);
    desktop.addEventListener("change", apply);
    return () => {
      mobile.removeEventListener("change", apply);
      desktop.removeEventListener("change", apply);
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

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
          onClick={() => setMobileOpen(false)}
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
          collapsed={collapsed}
          overlay={mobileOpen}
          user={user}
          criticalAlertCount={criticalAlertCount}
          onToggle={() => setCollapsed((value) => !value)}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        <div className="flex items-center gap-3 border-b border-line bg-sidebar px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] text-white md:hidden">
          <button
            type="button"
            className="rounded-md p-1.5 text-white hover:bg-sidebar-hover"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>
          <p className="text-[13px] font-semibold tracking-[0.18em]">NOXHEIM</p>
          <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-teal text-[10px] font-semibold">
            {user?.initials ?? "?"}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function AppShell({
  children,
  user = null,
  criticalAlertCount = 0,
}: {
  children: ReactNode;
  user?: CurrentUserProfile | null;
  criticalAlertCount?: number;
}) {
  return (
    <ToastProvider>
      <WorkspaceProvider>
        <ShellFrame user={user} criticalAlertCount={criticalAlertCount}>
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
