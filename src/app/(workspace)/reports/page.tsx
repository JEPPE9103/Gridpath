import { ReportsPage } from "@/features/reports/reports-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return <ReportsPage />;
}
