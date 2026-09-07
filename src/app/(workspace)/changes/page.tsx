import { getGridChangesForCurrentOrganization } from "@/lib/data/grid-changes";
import { ChangesPage } from "@/features/changes/changes-page";
import { formatHeaderDate } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Changes" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    project?: string;
    impact?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const result = await getGridChangesForCurrentOrganization();
  return (
    <ChangesPage
      result={result}
      headerDate={formatHeaderDate()}
      initialStatus={params.status ?? "unreviewed"}
      initialProjectId={params.project ?? "All"}
      initialImpactId={params.impact ?? null}
      initialPage={Number(params.page) || 1}
    />
  );
}
