"use client";

import { DocumentTable } from "@/features/documents/document-table";
import { DocumentUploadForm } from "@/features/documents/document-upload-form";
import { BellButton } from "@/components/layout/app-shell";
import { EmptyState, EmptyProjectsAction, EmptyWorkspaceAction } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  DOCUMENT_CATEGORY_FILTERS,
  DOCUMENT_STATUS_FILTERS,
  type DocumentListCategory,
  type DocumentListItem,
  type DocumentProjectOption,
  type DocumentsResult,
} from "@/lib/data/documents-types";
import { ClientHeaderDate } from "@/components/ui/client-header-date";
import type { DocumentStatus } from "@/types";
import { useMemo, useState } from "react";

export function DocumentsPage({ result }: { result: DocumentsResult }) {
  if (result.kind === "no_organization") {
    return (
      <>
        <PageHeader title="Documents" subtitle="Portfolio document workspace" />
        <div className="px-4 py-8 sm:px-6 lg:px-8">
          <EmptyState
            title="No workspace yet"
            description="This account is not a member of an organisation. Create or join a workspace to see documents."
            action={<EmptyWorkspaceAction />}
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
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState<DocumentListCategory | "All">("All");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "All">("All");

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

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle={`${documents.length} customer-provided documents across ${projects.length} projects`}
        actions={
          <>
            <BellButton />
            <ClientHeaderDate />
          </>
        }
      />
      <div className="space-y-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
        {canWrite ? <DocumentUploadForm projects={projects} /> : null}

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
            description={
              canWrite
                ? "Upload a PDF, Word, Excel, or image file to store it privately on a project."
                : "No project documents have been uploaded in this workspace yet."
            }
            action={projects.length === 0 ? <EmptyProjectsAction /> : undefined}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No documents match"
            description="Clear search or filters to see the full document workspace."
          />
        ) : (
          <DocumentTable rows={rows} canWrite={canWrite} showProject />
        )}
      </div>
    </>
  );
}
