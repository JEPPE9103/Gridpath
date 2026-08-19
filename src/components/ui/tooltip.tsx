"use client";

import { cn } from "@/lib/cn";
import { useState, type ReactNode } from "react";

export function Tooltip({
  content,
  children,
}: {
  content: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open ? (
        <span
          className={cn(
            "absolute bottom-[calc(100%+6px)] left-1/2 z-30 w-64 -translate-x-1/2 rounded-md border border-line bg-ink px-3 py-2 text-xs leading-4 text-white shadow-sm",
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
