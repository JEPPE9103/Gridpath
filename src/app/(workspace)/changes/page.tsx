import { ChangesPage } from "@/features/changes/changes-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Changes" };

export default function Page() {
  return <ChangesPage />;
}
