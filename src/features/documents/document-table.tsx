"use client";

import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { DOCUMENT_STATUS_FILTERS } from "@/lib/data/documents-types";
import {
  deleteProjectDocument,
  getDocumentDownloadUrl,
  updateDocumentStatus,
} from "@/lib/documents/actions";
import { formatFileSize, type DocumentFileKind } from "@/lib/documents/file-types";
import { formatDate } from "@/lib/format";
import type { DocumentStatus } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type DocumentTableRow = {
  id: string;
  name: string;
  category: string;
  status: DocumentStatus;
  fileKind: DocumentFileKind;
  fileSizeBytes: number | null;
  uploadedAt: string | null;
  uploadedByName: string | null;
  hasStoredFile: boolean;
  projectName?: string;
  projectSlug?: string;
};

export function DocumentTable({
  rows,
  canWrite,
  showProject = false,
}: {
  rows: DocumentTableRow[];
  canWrite: boolean;
  showProject?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table className="w-full min-w-[1080px] text-left text-sm">
        <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Document</th>
            {showProject ? <th className="px-4 py-2 font-medium">Project</th> : null}
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium">Category</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Uploaded</th>
            <th className="px-4 py-2 font-medium">Size</th>
            <th className="px-4 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((doc) => (
            <DocumentTableItem
              key={doc.id}
              doc={doc}
              canWrite={canWrite}
              showProject={showProject}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentTableItem({
  doc,
  canWrite,
  showProject,
}: {
  doc: DocumentTableRow;
  canWrite: boolean;
  showProject: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function onOpen() {
    startTransition(async () => {
      const result = await getDocumentDownloadUrl(doc.id);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  function onStatusChange(status: DocumentStatus) {
    startTransition(async () => {
      const result = await updateDocumentStatus(doc.id, status);
      if (!result.ok) {
        setMessage(result.error ?? "Could not update status.");
        return;
      }
      router.refresh();
    });
  }

  function onDelete() {
    if (
      !window.confirm(
        `Delete ${doc.name}? This removes the stored file and the document record.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteProjectDocument(doc.id);
      if (!result.ok) {
        setMessage(result.error ?? "Could not delete the document.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <tr className="border-b border-line last:border-0">
      <td className="px-4 py-3">
        <div className="font-medium">{doc.name}</div>
        {!doc.hasStoredFile ? (
          <p className="mt-1 text-xs text-muted">Metadata only — no stored file</p>
        ) : null}
      </td>
      {showProject ? (
        <td className="px-4 py-3">
          {doc.projectSlug ? (
            <Link href={`/projects/${doc.projectSlug}?tab=documents`} className="hover:text-teal">
              {doc.projectName}
            </Link>
          ) : (
            (doc.projectName ?? "—")
          )}
        </td>
      ) : null}
      <td className="px-4 py-3">{doc.hasStoredFile ? doc.fileKind : "—"}</td>
      <td className="px-4 py-3">{doc.category}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={doc.status} />
          {canWrite ? (
            <select
              value={doc.status}
              onChange={(event) => onStatusChange(event.target.value as DocumentStatus)}
              disabled={pending}
              className="rounded-md border border-line bg-surface px-1 py-0.5 text-xs"
            >
              {DOCUMENT_STATUS_FILTERS.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3 text-muted">
        <div>{doc.uploadedByName ?? doc.uploadedAt ? (doc.uploadedByName ?? "Team member") : "—"}</div>
        <div className="text-xs">{doc.uploadedAt ? formatDate(doc.uploadedAt) : "No file uploaded"}</div>
      </td>
      <td className="px-4 py-3 text-muted">
        {doc.hasStoredFile ? formatFileSize(doc.fileSizeBytes) : "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {doc.hasStoredFile ? (
            <Button type="button" variant="secondary" disabled={pending} onClick={onOpen}>
              {pending ? "Opening…" : "Open / download"}
            </Button>
          ) : null}
          {canWrite ? (
            <Button type="button" variant="secondary" disabled={pending} onClick={onDelete}>
              Delete
            </Button>
          ) : null}
        </div>
        {message ? <p className="mt-1 text-xs text-critical">{message}</p> : null}
      </td>
    </tr>
  );
}
