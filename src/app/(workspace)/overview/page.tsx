import { OverviewPage } from "@/features/overview/overview-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <OverviewPage />;
}
