"use client";

import { BellButton } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast-provider";
import {
  DOCUMENT_CATEGORY_FILTERS,
  DOCUMENT_STATUS_FILTERS,
  type DocumentListCategory,
  type DocumentListItem,
  type DocumentProjectOption,
  type DocumentsResult,
} from "@/lib/data/documents-types";
import { createDocumentRecord, updateDocumentStatus } from "@/lib/documents/actions";
import { ClientHeaderDate } from "@/components/ui/client-header-date";
import { formatDate } from "@/lib/format";
import type { DocumentStatus } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

export function DocumentsPage({ result }: { result: DocumentsResult }) {
  if (result.kind === "no_organization") {
    return (
      <>
        <PageHeader title="Documents" subtitle="Portfolio document workspace" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="No workspace yet"
            description="This account is not a member of an organisation. Create or join a workspace to see documents."
          />
        </div>
      </>
    );
  }

  if (result.kind === "error") {
    return (
      <>
        <PageHeader title="Documents" subtitle="Portfolio document workspace" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="Could not load documents"
            description="Try again in a moment. If the problem continues, sign in again."
          />
        </div>
      </>
    );
  }

  return (
    <LoadedDocumentsPage
      documents={result.documents}
      projects={result.projects}
      canWrite={result.canWrite}
    />
  );
}

function LoadedDocumentsPage({
  documents,
  projects,
  canWrite,
}: {
  documents: DocumentListItem[];
  projects: DocumentProjectOption[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState<DocumentListCategory | "All">("All");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "All">("All");
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [category, setCategory] = useState<DocumentListCategory>("Technical");
  const [createStatus, setCreateStatus] = useState<DocumentStatus>("Missing");

  const projectOptions = useMemo(
    () => ["All", ...projects.map((project) => project.name)],
    [projects],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((doc) => {
      const matchesQuery =
        !q ||
        doc.name.toLowerCase().includes(q) ||
        doc.projectName.toLowerCase().includes(q);
      return (
        matchesQuery &&
        (projectFilter === "All" || doc.projectName === projectFilter) &&
        (categoryFilter === "All" || doc.category === categoryFilter) &&
        (statusFilter === "All" || doc.status === statusFilter)
      );
    });
  }, [documents, query, projectFilter, categoryFilter, statusFilter]);

  function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !projectId || !canWrite) {
      return;
    }
    startTransition(async () => {
      const result = await createDocumentRecord({
        name: name.trim(),
        projectId,
        category,
        status: createStatus,
      });
      if (!result.ok) {
        pushToast({
          title: "Could not create document record",
          description: "The metadata was not saved.",
          tone: "warning",
        });
        return;
      }
      setName("");
      router.refresh();
      pushToast({
        title: "Document record added",
        description: "Metadata only. No file was uploaded.",
        tone: "success",
      });
    });
  }

  function onStatusChange(documentId: string, status: DocumentStatus) {
    if (!canWrite) {
      return;
    }
    startTransition(async () => {
      const result = await updateDocumentStatus(documentId, status);
      if (!result.ok) {
        pushToast({
          title: "Could not update document",
          description: "The change was not saved.",
          tone: "warning",
        });
        return;
      }
      router.refresh();
      pushToast({ title: "Document status updated", tone: "success" });
    });
  }

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle={`${documents.length} documents across ${projects.length} projects`}
        actions={
          <>
            <BellButton />
            <ClientHeaderDate />
          </>
        }
      />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        {canWrite ? (
          <form
            className="flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface p-4"
            onSubmit={onCreate}
          >
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">Document</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Document name"
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
                onChange={(event) =>
                  setCategory(event.target.value as DocumentListCategory)
                }
                className="h-9 rounded-md border border-line bg-surface px-2"
              >
                {DOCUMENT_CATEGORY_FILTERS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted">Status</span>
              <select
                value={createStatus}
                onChange={(event) =>
                  setCreateStatus(event.target.value as DocumentStatus)
                }
                className="h-9 rounded-md border border-line bg-surface px-2"
              >
                {DOCUMENT_STATUS_FILTERS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={isPending || !projectId}>
              Add document record
            </Button>
            <p className="text-xs text-muted">
              File storage is not connected in this development build.
            </p>
          </form>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search document or project"
            className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm sm:w-64"
          />
          <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2 text-sm">
            <span className="text-muted">Project</span>
            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="bg-transparent"
            >
              {projectOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2 text-sm">
            <span className="text-muted">Category</span>
            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value as DocumentListCategory | "All")
              }
              className="bg-transparent"
            >
              <option>All</option>
              {DOCUMENT_CATEGORY_FILTERS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-2 text-sm">
            <span className="text-muted">Status</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as DocumentStatus | "All")
              }
              className="bg-transparent"
            >
              <option>All</option>
              {DOCUMENT_STATUS_FILTERS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        {documents.length === 0 ? (
          <EmptyState
            title="No documents"
            description="Add a document record to see it listed against a project. Files are not stored yet."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No documents match"
            description="Clear search or filters to see the full document workspace."
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
                {rows.map((doc) => (
                  <tr key={doc.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-medium">{doc.name}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/projects/${doc.projectSlug}?tab=documents`}
                        className="hover:text-teal"
                      >
                        {doc.projectName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{doc.category}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={doc.status} />
                        {canWrite ? (
                          <select
                            value={doc.status}
                            onChange={(event) =>
                              onStatusChange(doc.id, event.target.value as DocumentStatus)
                            }
                            disabled={isPending}
                            className="rounded-md border border-line bg-surface px-1 py-0.5 text-xs"
                          >
                            {DOCUMENT_STATUS_FILTERS.map((status) => (
                              <option key={status}>{status}</option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(doc.updatedAt)}</td>
                    <td className="px-4 py-3">{doc.ownerName ?? "Unassigned"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
