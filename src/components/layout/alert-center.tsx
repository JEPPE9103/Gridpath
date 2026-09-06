"use client";

import { dismissOrganizationAlert } from "@/lib/alerts/actions";
import type { AlertCenterItem, AlertCenterSnapshot } from "@/lib/data/open-alerts";
import { formatRelative } from "@/lib/format";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";

const EMPTY_SNAPSHOT: AlertCenterSnapshot = {
  openCount: 0,
  criticalCount: 0,
  recent: [],
  canWrite: false,
};

const AlertCenterContext = createContext<AlertCenterSnapshot>(EMPTY_SNAPSHOT);

export function AlertCenterProvider({
  snapshot,
  children,
}: {
  snapshot: AlertCenterSnapshot;
  children: ReactNode;
}) {
  return <AlertCenterContext.Provider value={snapshot}>{children}</AlertCenterContext.Provider>;
}

export function BellButton() {
  const snapshot = useContext(AlertCenterContext);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const now = useMemo(() => new Date(), []);

  function onDismiss(alertId: string) {
    setPendingId(alertId);
    startTransition(async () => {
      await dismissOrganizationAlert(alertId);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-md p-2 text-muted hover:bg-surface hover:text-ink"
        aria-label="Open alerts"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={16} strokeWidth={1.75} />
        {snapshot.openCount > 0 ? (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-critical px-1 text-[10px] font-semibold text-white">
            {snapshot.openCount > 99 ? "99+" : snapshot.openCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close alerts"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-md border border-line bg-surface p-2 shadow-lg">
            <div className="flex items-center justify-between gap-2 px-2 py-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Open alerts
              </p>
              <Link
                href="/alerts"
                className="text-xs font-medium text-teal hover:underline"
                onClick={() => setOpen(false)}
              >
                View all
              </Link>
            </div>
            {snapshot.recent.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted">No open alerts.</p>
            ) : (
              <ul className="max-h-80 overflow-auto">
                {snapshot.recent.map((alert) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    now={now}
                    canWrite={snapshot.canWrite}
                    dismissing={isPending && pendingId === alert.id}
                    onDismiss={onDismiss}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function AlertRow({
  alert,
  now,
  canWrite,
  dismissing,
  onDismiss,
  onNavigate,
}: {
  alert: AlertCenterItem;
  now: Date;
  canWrite: boolean;
  dismissing: boolean;
  onDismiss: (id: string) => void;
  onNavigate: () => void;
}) {
  return (
    <li className="rounded-md px-2 py-2 hover:bg-canvas">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{alert.severity}</p>
      <p className="text-sm font-medium text-ink">{alert.title}</p>
      <p className="mt-0.5 text-xs text-muted">
        {alert.projectName ? `${alert.projectName} · ` : ""}
        {formatRelative(alert.createdAt, now)}
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        <Link href={alert.href} className="text-xs font-medium text-teal hover:underline" onClick={onNavigate}>
          View
        </Link>
        {canWrite ? (
          <button
            type="button"
            className="text-xs text-muted hover:text-ink disabled:opacity-50"
            disabled={dismissing}
            onClick={() => onDismiss(alert.id)}
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </li>
  );
}
