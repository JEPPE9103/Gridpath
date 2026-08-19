import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function AppFrame({
  children,
  url = "app.noxheim.com/overview",
  className,
}: {
  children: ReactNode;
  url?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-line bg-surface shadow-[0_28px_64px_-32px_rgba(26,30,36,0.45)]",
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-line bg-canvas px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-[#d8d4ce]" />
        <span className="h-2 w-2 rounded-full bg-[#d8d4ce]" />
        <span className="h-2 w-2 rounded-full bg-[#d8d4ce]" />
        <span className="ml-2 truncate font-mono text-[11px] text-muted">{url}</span>
      </div>
      {children}
    </div>
  );
}
