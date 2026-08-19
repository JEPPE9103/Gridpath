"use client";

import { BellButton } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate, formatHeaderDate } from "@/lib/format";
import { documentRepository, projectRepository } from "@/lib/repositories";
import { useWorkspace } from "@/lib/workspace-state";
import {
  DOCUMENT_CATEGORIES,
  type DocumentCategory,
  type DocumentStatus,
} from "@/types";
import Link from "next/link";
import { useMemo, useState } from "react";

const STATUSES: DocumentStatus[] = ["Draft", "Missing", "In Progress", "Complete"];

export function DocumentsPage() {
  const { overlays, addDocument, setDocumentStatus } = useWorkspace();
  const projects = useMemo(() => projectRepository.list(overlays), [overlays]);
  const documents = useMemo(() => documentRepository.list(overlays), [overlays]);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [category, setCategory] = useState<DocumentCategory>("Technical");

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Portfolio document workspace"
        actions={
          <>
            <BellButton />
            <span className="text-sm text-muted">{formatHeaderDate("2026-08-18")}</span>
          </>
        }
      />
      <div className="space-y-4 px-8 py-6">
        <form
          className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim() || !projectId) return;
            addDocument({ name: name.trim(), projectId, category });
            setName("");
          }}
        >
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Document</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Placeholder file name"
              className="h-9 w-56 rounded-md border border-line px-3"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Project</span>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="h-9 rounded-md border border-line bg-surface px-2"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as DocumentCategory)}
              className="h-9 rounded-md border border-line bg-surface px-2"
            >
              {DOCUMENT_CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <Button type="submit">Upload placeholder</Button>
          <p className="text-xs text-muted">No file is stored. Demo only.</p>
        </form>

        {documents.length === 0 ? (
          <EmptyState
            title="No documents"
            description="Add a placeholder document to see it listed against a project."
          />
        ) : (
          <div className="overflow-x-auto rounded-md border border-line bg-surface">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Document</th>
                  <th className="px-4 py-2 font-medium">Project</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Updated</th>
                  <th className="px-4 py-2 font-medium">Owner</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const project = projects.find((item) => item.id === doc.projectId);
                  return (
                    <tr key={doc.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-medium">{doc.name}</td>
                      <td className="px-4 py-3">
                        {project ? (
                          <Link
                            href={`/projects/${project.id}?tab=documents`}
                            className="hover:text-teal"
                          >
                            {project.name}
                          </Link>
                        ) : (
                          doc.projectId
                        )}
                      </td>
                      <td className="px-4 py-3">{doc.category}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={doc.status} />
                          <select
                            value={doc.status}
                            onChange={(event) =>
                              setDocumentStatus(doc.id, event.target.value as DocumentStatus)
                            }
                            className="rounded-md border border-line bg-surface px-1 py-0.5 text-xs"
                          >
                            {STATUSES.map((status) => (
                              <option key={status}>{status}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">{formatDate(doc.updatedAt)}</td>
                      <td className="px-4 py-3">{doc.owner}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
