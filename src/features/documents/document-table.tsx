"use client";

import { StatusBadge } from "@/components/ui/badges";
import {
  destructiveActionClass,
  tableBodyRowClass,
  tableCellClass,
  tableHeadCellClass,
  tableHeadClass,
  tableWrapClass,
  textActionClass,
} from "@/components/ui/workspace";
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
    <div className={tableWrapClass}>
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className={tableHeadClass}>
          <tr>
            <th className={tableHeadCellClass}>Document</th>
            {showProject ? <th className={tableHeadCellClass}>Project</th> : null}
            <th className={tableHeadCellClass}>Type</th>
            <th className={tableHeadCellClass}>Category</th>
            <th className={tableHeadCellClass}>Status</th>
            <th className={tableHeadCellClass}>Uploaded</th>
            <th className={tableHeadCellClass}>Size</th>
            <th className={tableHeadCellClass}><span className="sr-only">Actions</span></th>
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
    <tr className={tableBodyRowClass}>
      <td className={tableCellClass}>
        <div className="font-medium">{doc.name}</div>
        {!doc.hasStoredFile ? (
          <p className="mt-0.5 text-[11px] text-muted">Metadata only — no stored file</p>
        ) : null}
      </td>
      {showProject ? (
        <td className={tableCellClass}>
          {doc.projectSlug ? (
            <Link href={`/projects/${doc.projectSlug}?tab=documents`} className="hover:text-teal">
              {doc.projectName}
            </Link>
          ) : (
            (doc.projectName ?? "—")
          )}
        </td>
      ) : null}
      <td className={`${tableCellClass} text-muted`}>{doc.hasStoredFile ? doc.fileKind : "—"}</td>
      <td className={tableCellClass}>{doc.category}</td>
      <td className={tableCellClass}>
        <div className="flex items-center gap-2">
          <StatusBadge status={doc.status} />
          {canWrite ? (
            <select
              value={doc.status}
              onChange={(event) => onStatusChange(event.target.value as DocumentStatus)}
              disabled={pending}
              aria-label={`Status for ${doc.name}`}
              className="rounded-md border border-line bg-surface px-1 py-0.5 text-xs"
            >
              {DOCUMENT_STATUS_FILTERS.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          ) : null}
        </div>
      </td>
      <td className={`${tableCellClass} text-muted`}>
        <div>{doc.uploadedByName ?? (doc.uploadedAt ? "Team member" : "—")}</div>
        <div className="text-xs">{doc.uploadedAt ? formatDate(doc.uploadedAt) : "No file uploaded"}</div>
      </td>
      <td className={`${tableCellClass} tabular-nums text-muted`}>
        {doc.hasStoredFile ? formatFileSize(doc.fileSizeBytes) : "—"}
      </td>
      <td className={`${tableCellClass} whitespace-nowrap text-right`}>
        {doc.hasStoredFile ? (
          <button type="button" className={textActionClass} disabled={pending} onClick={onOpen}>
            {pending ? "Opening…" : "Open →"}
          </button>
        ) : null}
        {canWrite ? (
          <details className="relative ml-3 inline-block text-left">
            <summary
              className="cursor-pointer list-none text-xs text-muted hover:text-ink [&::-webkit-details-marker]:hidden"
              aria-label={`More actions for ${doc.name}`}
            >
              More
            </summary>
            <div className="absolute right-0 z-10 mt-1 min-w-[8rem] rounded-md border border-line bg-surface py-1 shadow-sm">
              <button
                type="button"
                className={`block w-full px-3 py-1.5 text-left ${destructiveActionClass}`}
                disabled={pending}
                onClick={onDelete}
              >
                Delete
              </button>
            </div>
          </details>
        ) : null}
        {message ? <p className="mt-1 text-xs text-critical">{message}</p> : null}
      </td>
    </tr>
  );
}
