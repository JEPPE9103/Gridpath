import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: LucideIcon;
  tone?: "default" | "critical";
}) {
  return (
    <article className="rounded-md border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
          {label}
        </p>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md",
            tone === "critical" ? "bg-critical-bg text-critical" : "bg-teal-soft text-teal",
          )}
        >
          <Icon size={16} strokeWidth={1.75} />
        </span>
      </div>
      <p className="mt-3 text-[32px] font-semibold leading-none tracking-tight text-ink tabular-nums">
        {value}
      </p>
      <p className="mt-2 text-sm text-muted">{hint}</p>
    </article>
  );
}
