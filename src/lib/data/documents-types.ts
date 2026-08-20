import type { DocumentCategory, DocumentStatus } from "@/types";

export type DocumentListCategory = DocumentCategory | "Other";

export type DocumentListItem = {
  id: string;
  name: string;
  category: DocumentListCategory;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  storagePath: string | null;
  projectId: string;
  projectName: string;
  projectSlug: string;
  ownerName: string | null;
};

export type DocumentProjectOption = {
  id: string;
  name: string;
  slug: string;
};

export type DocumentsResult =
  | {
      kind: "ok";
      documents: DocumentListItem[];
      projects: DocumentProjectOption[];
      canWrite: boolean;
    }
  | { kind: "no_organization" }
  | { kind: "error"; message: string };

export const DOCUMENT_STATUS_FILTERS: DocumentStatus[] = [
  "Missing",
  "Draft",
  "In Progress",
  "Complete",
];

export const DOCUMENT_CATEGORY_FILTERS: DocumentListCategory[] = [
  "Technical",
  "Land",
  "Permit",
  "Grid",
  "Commercial",
  "Other",
];
