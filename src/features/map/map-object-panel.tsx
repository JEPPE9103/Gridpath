"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function MapObjectPanel({
  kind,
  provenance,
  title,
  subtitle,
  testId,
  onClose,
  children,
  action,
}: {
  kind: string;
  provenance: string;
  title: string;
  subtitle?: string;
  testId?: string;
  onClose: () => void;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <aside
      className="absolute inset-x-3 bottom-3 max-h-[42%] overflow-auto rounded-md border border-line bg-surface p-3 md:inset-x-auto md:bottom-auto md:right-3 md:top-3 md:max-h-[calc(100%-1.5rem)] md:w-[300px]"
      data-testid={testId}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
            {kind}
            <span className="mx-1.5 text-line">·</span>
            {provenance}
          </p>
          <h2 className="text-base font-semibold leading-5">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
        </div>
        <button type="button" onClick={onClose} className="text-muted hover:text-ink" aria-label="Close detail panel">
          <X size={14} />
        </button>
      </div>
      <div className="mt-3">{children}</div>
      {action ? <div className="mt-3">{action}</div> : null}
    </aside>
  );
}

export function MapFact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

export function MapPanelNote({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[11px] leading-4 text-muted">{children}</p>;
}

export function MapToolbarToggle({
  pressed,
  onClick,
  children,
  testId,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <Button
      type="button"
      variant={pressed ? "secondary" : "ghost"}
      aria-pressed={pressed}
      onClick={onClick}
      data-testid={testId}
      className="h-8 px-2.5 text-xs"
    >
      {children}
    </Button>
  );
}
