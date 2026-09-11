import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ReactNode } from "react";

export const pageBodyClass = "space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-6";

export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(pageBodyClass, className)}>{children}</div>;
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Panel({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("overflow-hidden rounded-md border border-line bg-surface", padded && "p-5", className)}>
      {children}
    </section>
  );
}

export function MetricStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4", className)}>
      {children}
    </section>
  );
}

export function Metric({
  label,
  value,
  href,
  hint,
  tone,
}: {
  label: string;
  value: string;
  href?: string;
  hint?: string;
  tone?: "critical" | "warning" | "success";
}) {
  const content = (
    <>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums leading-7 text-ink",
          tone === "critical" && value !== "0" && "text-critical",
          tone === "warning" && value !== "0" && "text-warning",
          tone === "success" && value !== "0" && "text-success",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </>
  );
  const className = "bg-surface px-4 py-3.5";
  if (href) {
    return (
      <Link href={href} className={`${className} hover:bg-canvas`}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function FilterSelect({
  value,
  onChange,
  options,
  label,
  labels,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  label: string;
  labels?: Record<string, string>;
}) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2 text-sm">
      <span className="text-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[12rem] bg-transparent text-ink"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AttentionDot({ band }: { band?: "action" | "attention" | "review" | "clear" }) {
  const tone =
    band === "action"
      ? "bg-critical"
      : band === "attention"
        ? "bg-warning"
        : band === "review"
          ? "bg-info"
          : "bg-line";
  const label =
    band === "action"
      ? "Action required"
      : band === "attention"
        ? "Watch"
        : band === "review"
          ? "Review"
          : "No immediate action";
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${tone}`} title={label} aria-label={label} />;
}

export function TechnicalDetails({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-medium text-muted hover:text-ink">
        {summary}
      </summary>
      <div className="mt-2 text-xs leading-5 text-muted">{children}</div>
    </details>
  );
}

export const tableWrapClass = "overflow-x-auto rounded-md border border-line bg-surface";

export const tableClass = "w-full text-left text-sm";

export const tableHeadClass = "border-b border-line bg-canvas text-[11px] uppercase tracking-wide text-muted";

export const tableHeadCellClass = "px-3 py-2 font-medium";

export const tableCellClass = "px-3 py-2.5 align-middle";
