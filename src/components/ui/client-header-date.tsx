"use client";

import { formatDate, formatHeaderDate } from "@/lib/format";
import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

/** Client-only header date so SSR and hydration never disagree on locale/timezone. */
export function ClientHeaderDate({ iso }: { iso?: string }) {
  const label = useSyncExternalStore(
    subscribe,
    () => (iso ? formatHeaderDate(iso) : formatHeaderDate()),
    () => null,
  );

  if (!label) {
    return null;
  }

  return <span className="hidden text-sm text-muted sm:inline">{label}</span>;
}

/** Client-only absolute date for values that can differ by timezone across SSR/client. */
export function ClientAbsoluteDate({
  iso,
  empty = "—",
}: {
  iso: string | null | undefined;
  empty?: string;
}) {
  const label = useSyncExternalStore(
    subscribe,
    () => (iso ? formatDate(iso) : empty),
    () => null,
  );

  if (label === null) {
    return null;
  }

  return <>{label}</>;
}
