import { getDocumentsForCurrentOrganization } from "@/lib/data/documents";
import { DocumentsPage } from "@/features/documents/documents-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const result = await getDocumentsForCurrentOrganization();
  return <DocumentsPage result={result} />;
}
