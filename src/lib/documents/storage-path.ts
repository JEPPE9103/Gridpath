const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PROJECT_DOCUMENTS_BUCKET = "project-documents";

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function sanitizeOriginalFilename(filename: string): string {
  const trimmed = filename.trim().replace(/\\/g, "/");
  const base = trimmed.split("/").pop()?.trim() || "document";
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").replace(/^\.+/, "");
  const name = cleaned.slice(0, 180) || "document";
  return name;
}

export function buildDocumentStoragePath(input: {
  organizationId: string;
  projectId: string;
  documentId: string;
  originalFilename: string;
}): string {
  if (
    !isUuid(input.organizationId) ||
    !isUuid(input.projectId) ||
    !isUuid(input.documentId)
  ) {
    throw new Error("Invalid document storage path identifiers.");
  }
  const filename = sanitizeOriginalFilename(input.originalFilename);
  return `${input.organizationId}/${input.projectId}/${input.documentId}/${filename}`;
}

export function parseDocumentStoragePath(path: string): {
  organizationId: string;
  projectId: string;
  documentId: string;
  originalFilename: string;
} | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 4) {
    return null;
  }
  const [organizationId, projectId, documentId, originalFilename] = parts;
  if (!isUuid(organizationId) || !isUuid(projectId) || !isUuid(documentId)) {
    return null;
  }
  return { organizationId, projectId, documentId, originalFilename };
}

export function storagePathBelongsToTenant(
  path: string,
  organizationId: string,
  projectId: string,
): boolean {
  const parsed = parseDocumentStoragePath(path);
  return (
    parsed !== null &&
    parsed.organizationId === organizationId &&
    parsed.projectId === projectId
  );
}
