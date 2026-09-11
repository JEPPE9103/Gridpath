import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start rounded-md border border-dashed border-line bg-surface px-5 py-8">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mt-1 max-w-lg text-sm text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start rounded-md border border-critical/25 bg-critical-bg/50 px-5 py-6" role="alert">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mt-1 max-w-lg text-sm text-muted">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function EmptyWorkspaceAction() {
  return (
    <Link href="/onboarding" className={buttonClassName()}>
      Create workspace
    </Link>
  );
}

export function EmptyProjectsAction() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/opportunities/new" className={buttonClassName()}>
        New search
      </Link>
      <Link href="/projects/new" className={buttonClassName("secondary")}>
        Add project
      </Link>
      <Link href="/portfolio/import" className={buttonClassName("secondary")}>
        Import
      </Link>
    </div>
  );
}

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-5 text-muted", className)}>
      Indicative grid intelligence only. Formal grid operator assessment required.
      NOXHEIM does not guarantee grid capacity.
    </p>
  );
}

export function EstimateNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-5 text-muted", className)} title="Estimates use customer-defined assumptions and workflow activity.">
      Estimates use customer-defined assumptions and workflow activity. Not verified savings.
    </p>
  );
}
