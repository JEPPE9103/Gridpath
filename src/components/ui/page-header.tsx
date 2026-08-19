import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex min-h-[72px] items-start justify-between gap-6 border-b border-line bg-canvas px-8 py-5">
      <div>
        <h1 className="text-[28px] font-semibold leading-8 tracking-tight text-ink">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3 pt-1">{actions}</div>
    </header>
  );
}

export function HeaderMeta({
  dateLabel,
}: {
  dateLabel: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted">
      <span className="hidden sm:inline">{dateLabel}</span>
    </div>
  );
}
