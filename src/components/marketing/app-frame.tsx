import { cn } from "@/lib/cn";
import { MARKETING_APP_HOST } from "@/lib/site-url";
import type { ReactNode } from "react";

export function AppFrame({
  children,
  path = "/overview",
  className,
}: {
  children: ReactNode;
  path?: string;
  className?: string;
}) {
  const pathname = path.startsWith("/") ? path : `/${path}`;

  return (
    <div
      className={cn(
        "max-w-full overflow-hidden rounded-lg border border-line bg-surface shadow-[0_28px_64px_-32px_rgba(26,30,36,0.45)]",
        className,
      )}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-line bg-canvas px-3 py-2.5">
        <div className="min-w-0">
          <p className="hidden text-[10px] font-semibold tracking-[0.18em] text-muted sm:block">
            NOXHEIM
          </p>
        </div>
        <div className="flex min-w-0 max-w-[min(100%,22rem)] items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1">
          <LockMark />
          <p className="truncate font-mono text-[11px] leading-none">
            <span className="text-ink">{MARKETING_APP_HOST}</span>
            <span className="text-muted">{pathname}</span>
          </p>
        </div>
        <span className="justify-self-end text-[10px] uppercase tracking-wide text-muted">
          Sample
        </span>
      </div>
      {children}
    </div>
  );
}

function LockMark() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="h-2.5 w-2.5 shrink-0 text-muted"
      aria-hidden
    >
      <rect
        x="2.75"
        y="5.4"
        width="6.5"
        height="4.6"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
      />
      <path
        d="M4.15 5.4V3.95a1.85 1.85 0 0 1 3.7 0V5.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
      />
    </svg>
  );
}
