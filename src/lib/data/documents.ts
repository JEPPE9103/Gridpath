import { applyArchiveFilter } from "@/lib/data/archive-filter";
import { getCurrentOrganization } from "@/lib/data/organization";
import { fetchAllQueryPages } from "@/lib/data/paged-select";
import type {
  DocumentListItem,
  DocumentProjectOption,
  DocumentsResult,
} from "@/lib/data/documents-types";
import { asSingle, toNumber } from "@/lib/data/row-utils";
import { canUploadDocuments, documentHasStoredFile } from "@/lib/documents/authorization";
import { documentFileKind } from "@/lib/documents/file-types";
import {
  documentCategoryLabel,
  documentStatusLabel,
} from "@/lib/domain/catalog-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type {
  DocumentListItem,
  DocumentProjectOption,
  DocumentsResult,
} from "@/lib/data/documents-types";
export {
  DOCUMENT_CATEGORY_FILTERS,
  DOCUMENT_STATUS_FILTERS,
} from "@/lib/data/documents-types";

type ProjectEmbed = {
  id: string;
  name: string;
  slug: string;
  organization_id: string;
};

type ProfileRow = { id: string; full_name: string | null };

type DocumentRow = {
  id: string;
  name: string;
  category: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | string | null;
  uploaded_by: string | null;
  uploaded_at: string | null;
  projects: ProjectEmbed | ProjectEmbed[] | null;
};

function profileName(profiles: ProfileRow[], id: string | null): string | null {
  if (!id) {
    return null;
  }
  const name = profiles.find((row) => row.id === id)?.full_name?.trim();
  return name || null;
}

function mapDocument(row: DocumentRow, profiles: ProfileRow[]): DocumentListItem | null {
  const project = asSingle(row.projects);
  if (!project?.slug) {
    return null;
  }

  const storagePath = row.storage_path?.trim() || null;
  const uploadedByName = profileName(profiles, row.uploaded_by) ?? profileName(profiles, row.owner_id);

  return {
    id: row.id,
    name: row.name,
    category: documentCategoryLabel(row.category),
    status: documentStatusLabel(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    storagePath,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileKind: documentFileKind(row.mime_type, row.original_filename ?? row.name),
    fileSizeBytes: row.file_size_bytes == null ? null : toNumber(row.file_size_bytes),
    uploadedAt: row.uploaded_at,
    uploadedByName,
    hasStoredFile: documentHasStoredFile(storagePath),
    projectId: project.id,
    projectName: project.name,
    projectSlug: project.slug,
    ownerName: profileName(profiles, row.owner_id),
  };
}

export async function getDocumentsForCurrentOrganization(): Promise<DocumentsResult> {
  const organization = await getCurrentOrganization();
  if (!organization) {
    return { kind: "no_organization" };
  }

  const supabase = await createSupabaseServerClient();
  const [documentsPage, projectsPage] = await Promise.all([
    fetchAllQueryPages<DocumentRow>(async (from, to) => {
      const page = await applyArchiveFilter(
        supabase
          .from("documents")
          .select(
            `
            id,
            name,
            category,
            status,
            created_at,
            updated_at,
            owner_id,
            storage_path,
            original_filename,
            mime_type,
            file_size_bytes,
            uploaded_by,
            uploaded_at,
            projects!inner ( id, name, slug, organization_id, archived_at )
          `,
          )
          .eq("projects.organization_id", organization.id)
          .order("updated_at", { ascending: false }),
        "active",
        "projects.archived_at",
      ).range(from, to);
      return { data: page.data as DocumentRow[] | null, error: page.error };
    }),
    fetchAllQueryPages<{ id: string; name: string; slug: string }>(async (from, to) => {
      const page = await applyArchiveFilter(
        supabase
          .from("projects")
          .select("id, name, slug, archived_at")
          .eq("organization_id", organization.id)
          .order("name", { ascending: true }),
        "active",
      ).range(from, to);
      return { data: page.data as Array<{ id: string; name: string; slug: string }> | null, error: page.error };
    }),
  ]);

  if (documentsPage.error || projectsPage.error) {
    console.error(
      "getDocumentsForCurrentOrganization failed",
      documentsPage.error ?? projectsPage.error,
    );
    return { kind: "error", message: "Could not load documents." };
  }

  const rows = documentsPage.rows;
  const ownerIds = [
    ...new Set(
      rows
        .flatMap((row) => [row.owner_id, row.uploaded_by])
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  let profiles: ProfileRow[] = [];
  if (ownerIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ownerIds);
    if (profileError) {
      console.error("getDocumentsForCurrentOrganization profiles failed", profileError.message);
    } else {
      profiles = (profileRows ?? []) as ProfileRow[];
    }
  }

  const projects: DocumentProjectOption[] = projectsPage.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
  }));

  return {
    kind: "ok",
    documents: rows
      .map((row) => mapDocument(row, profiles))
      .filter((item): item is DocumentListItem => item !== null),
    projects,
    canWrite: canUploadDocuments(organization.role),
  };
}
