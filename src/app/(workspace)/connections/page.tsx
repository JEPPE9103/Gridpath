import { ConnectionsPage } from "@/features/connections/connections-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Connections" };

export default function Page() {
  return <ConnectionsPage />;
}
