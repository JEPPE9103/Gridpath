"use client";

import { useFormStatus } from "react-dom";

export function RefinePendingNotice() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <p className="mt-2 max-w-sm text-xs leading-5 text-muted" role="status" aria-live="polite">
      Refining selected candidate with higher-resolution evidence. Typically under two seconds. You can
      wait on this page.
    </p>
  );
}
