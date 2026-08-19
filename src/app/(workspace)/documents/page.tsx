import { DocumentsPage } from "@/features/documents/documents-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Documents" };

export default function Page() {
  return <DocumentsPage />;
}
