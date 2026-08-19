"use client";

import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/cn";

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-[min(420px,calc(100%-2rem))] -translate-x-1/2 flex-col gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismissToast(toast.id)}
          className={cn(
            "pointer-events-auto rounded-md border px-4 py-3 text-left shadow-sm",
            toast.tone === "success"
              ? "border-teal bg-ink text-white"
              : toast.tone === "warning"
                ? "border-warning bg-ink text-white"
                : "border-line bg-ink text-white",
          )}
        >
          <p className="text-sm font-medium">{toast.title}</p>
          {toast.description ? (
            <p className="mt-0.5 text-xs text-white/70">{toast.description}</p>
          ) : null}
        </button>
      ))}
    </div>
  );
}
