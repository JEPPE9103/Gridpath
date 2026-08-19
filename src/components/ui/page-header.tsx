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
    <header className="flex flex-col gap-3 border-b border-line bg-canvas px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-6 sm:py-5 lg:px-8">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-7 tracking-tight text-ink sm:text-[28px] sm:leading-8">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:pt-1">{actions}</div>
      ) : null}
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
