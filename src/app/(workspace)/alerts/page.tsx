import { AlertsPage } from "@/features/alerts/alerts-page";
import { getWorkspaceAlerts } from "@/lib/data/alerts";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Alerts" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const result = await getWorkspaceAlerts({ status: "all" });
  return (
    <AlertsPage alerts={result.alerts} canWrite={result.canWrite} kind={result.kind} />
  );
}
