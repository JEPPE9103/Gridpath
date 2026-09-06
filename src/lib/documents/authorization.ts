import { canWriteWorkflow } from "@/lib/projects/authorization";

export function canUploadDocuments(role: string | null | undefined): boolean {
  return canWriteWorkflow(role);
}

export function canDeleteDocuments(role: string | null | undefined): boolean {
  return canWriteWorkflow(role);
}

export function canChangeDocumentStatus(role: string | null | undefined): boolean {
  return canWriteWorkflow(role);
}

export function documentHasStoredFile(storagePath: string | null | undefined): boolean {
  return Boolean(storagePath && storagePath.trim());
}

export function assertProjectBelongsToOrganization(input: {
  projectOrganizationId: string;
  activeOrganizationId: string;
}): boolean {
  return input.projectOrganizationId === input.activeOrganizationId;
}

export type DocumentDeletionStep = "storage" | "record";

export function nextDocumentDeletionStep(input: {
  hasStoredFile: boolean;
  storageRemoved: boolean;
}): DocumentDeletionStep | "done" {
  if (input.hasStoredFile && !input.storageRemoved) {
    return "storage";
  }
  return "record";
}
