"use client";

import { DocumentTable } from "@/features/documents/document-table";
import { DocumentUploadForm } from "@/features/documents/document-upload-form";
import { BellButton } from "@/components/layout/app-shell";
import { EmptyState, EmptyProjectsAction, EmptyWorkspaceAction, ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar, FilterSelect, PageBody } from "@/components/ui/workspace";
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
        <PageHeader eyebrow="Monitor" title="Documents" subtitle="Development evidence and document control" />
        <PageBody>
          <EmptyState
            title="No workspace yet"
            description="This account is not a member of an organisation. Create or join a workspace to see documents."
            action={<EmptyWorkspaceAction />}
          />
        </PageBody>
      </>
    );
  }

  if (result.kind === "error") {
    return (
      <>
        <PageHeader eyebrow="Monitor" title="Documents" subtitle="Development evidence and document control" />
        <PageBody>
          <ErrorState
            title="Could not load documents"
            description="Try again in a moment. If the problem continues, sign in again."
          />
        </PageBody>
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
        eyebrow="Monitor"
        title="Documents"
        subtitle="Customer-provided files stored against projects. Filename matching is not an official requirement link."
        actions={
          <>
            <BellButton />
            <ClientHeaderDate />
          </>
        }
      />
      <PageBody className="space-y-4">
        {canWrite ? <DocumentUploadForm projects={projects} /> : null}

        <FilterBar>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search document or project"
            className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm sm:w-64"
          />
          <FilterSelect
            value={projectFilter}
            onChange={setProjectFilter}
            options={projectOptions}
            label="Project"
          />
          <FilterSelect
            value={categoryFilter}
            onChange={(value) => setCategoryFilter(value as DocumentListCategory | "All")}
            options={["All", ...DOCUMENT_CATEGORY_FILTERS]}
            label="Category"
          />
          <FilterSelect
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as DocumentStatus | "All")}
            options={["All", ...DOCUMENT_STATUS_FILTERS]}
            label="Status"
          />
        </FilterBar>

        {documents.length === 0 ? (
          <EmptyState
            title="No development documents yet"
            description={
              canWrite
                ? "Upload a PDF, Word, Excel, or image file to keep it with a project. This is workspace document control, not a shared drive."
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
      </PageBody>
    </>
  );
}
