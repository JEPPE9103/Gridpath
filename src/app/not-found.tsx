"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";

export default function NotFound() {
  return (
    <AppShell>
      <PageHeader title="Page not found" subtitle="The requested workspace view does not exist." />
      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="max-w-lg rounded-md border border-line bg-surface p-6">
          <p className="text-sm text-muted">
            Check the URL or return to the portfolio overview. Demo routes live under Overview,
            Portfolio, Map & Compare, Connections, Changes, Documents and Reports.
          </p>
          <Link href="/overview" className="mt-4 inline-block">
            <Button>Back to Overview</Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
