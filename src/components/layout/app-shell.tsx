"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ToastViewport } from "@/components/ui/toast-viewport";
import { WorkspaceProvider } from "@/lib/workspace-state";
import { Bell } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

function ShellFrame({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    const apply = () => setCollapsed(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        {children}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <WorkspaceProvider>
        <ShellFrame>{children}</ShellFrame>
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
