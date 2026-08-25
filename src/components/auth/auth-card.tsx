import Link from "next/link";
import type { ReactNode } from "react";

export function AuthCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[380px] rounded-md border border-line bg-surface p-8">
        <Link href="/" className="inline-block">
          <p className="text-[15px] font-semibold tracking-[0.18em] text-ink">NOXHEIM</p>
          <p className="mt-1 text-[11px] tracking-wide text-muted">Grid Intelligence</p>
        </Link>
        <h1 className="mt-6 text-lg font-semibold text-ink">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export const authInputClass =
  "mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-teal";

export const authSubmitClass =
  "flex h-10 w-full items-center justify-center rounded-md bg-teal text-sm font-medium text-white hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-50";
