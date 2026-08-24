import { getGridChangesForCurrentOrganization } from "@/lib/data/grid-changes";
import { ChangesPage } from "@/features/changes/changes-page";
import { formatHeaderDate } from "@/lib/format";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Changes" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const result = await getGridChangesForCurrentOrganization();
  return <ChangesPage result={result} headerDate={formatHeaderDate()} />;
}
