import { getConnectionCasesForCurrentOrganization } from "@/lib/data/connections";
import { ConnectionsPage } from "@/features/connections/connections-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Connections" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const result = await getConnectionCasesForCurrentOrganization();
  return <ConnectionsPage result={result} />;
}
