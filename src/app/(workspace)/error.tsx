"use client";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <PageHeader title="Something went wrong" subtitle="The workspace hit an unexpected error." />
      <div className="px-8 py-8">
        <div className="max-w-lg rounded-md border border-line bg-surface p-6">
          <p className="text-sm text-muted">
            Try again, or return to Overview. Demo data is local to this browser.
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={reset}>Try again</Button>
            <Link href="/overview">
              <Button variant="secondary">Overview</Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
