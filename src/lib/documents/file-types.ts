export const MAX_DOCUMENT_FILE_BYTES = 20 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export type DocumentFileKind = "PDF" | "Word" | "Excel" | "CSV" | "Image" | "File";

export function fileExtension(filename: string): string {
  const base = filename.trim().split(/[/\\]/).pop() ?? "";
  const index = base.lastIndexOf(".");
  if (index <= 0 || index === base.length - 1) {
    return "";
  }
  return base.slice(index + 1).toLowerCase();
}

export function mimeFromFilename(filename: string): string | null {
  const ext = fileExtension(filename);
  return EXTENSION_TO_MIME[ext] ?? null;
}

export function isAllowedDocumentMimeType(mimeType: string): boolean {
  return (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function resolveDocumentMimeType(input: {
  mimeType: string | null | undefined;
  filename: string;
}): string | null {
  const provided = input.mimeType?.trim().toLowerCase() || null;
  const fromName = mimeFromFilename(input.filename);
  if (provided && isAllowedDocumentMimeType(provided)) {
    if (fromName && provided !== fromName) {
      return null;
    }
    return provided;
  }
  if (fromName && isAllowedDocumentMimeType(fromName)) {
    return fromName;
  }
  return null;
}

export function documentFileKind(mimeType: string | null, filename?: string): DocumentFileKind {
  const mime = mimeType ?? mimeFromFilename(filename ?? "") ?? "";
  if (mime === "application/pdf") return "PDF";
  if (
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "Word";
  }
  if (
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "Excel";
  }
  if (mime === "text/csv") return "CSV";
  if (mime.startsWith("image/")) return "Image";
  return "File";
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round((bytes / 1024) * 10) / 10} KB`;
  }
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

export function validateDocumentUploadFile(input: {
  filename: string;
  mimeType: string | null | undefined;
  sizeBytes: number;
}): { ok: true; mimeType: string } | { ok: false; error: string } {
  if (!input.filename.trim()) {
    return { ok: false, error: "Choose a file to upload." };
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, error: "The file is empty." };
  }
  if (input.sizeBytes > MAX_DOCUMENT_FILE_BYTES) {
    return { ok: false, error: "Files must be 20 MB or smaller." };
  }
  const mimeType = resolveDocumentMimeType({
    mimeType: input.mimeType,
    filename: input.filename,
  });
  if (!mimeType) {
    return {
      ok: false,
      error: "Upload a PDF, Word, Excel, CSV, or common image file.",
    };
  }
  return { ok: true, mimeType };
}
