import { getCurrentOrganization } from "@/lib/data/organization";
import type {
  DocumentListItem,
  DocumentProjectOption,
  DocumentsResult,
} from "@/lib/data/documents-types";
import { asSingle } from "@/lib/data/row-utils";
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
  projects: ProjectEmbed | ProjectEmbed[] | null;
};

function writableRole(role: string): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

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

  return {
    id: row.id,
    name: row.name,
    category: documentCategoryLabel(row.category),
    status: documentStatusLabel(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    storagePath: null,
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
  const [documentsResult, projectsResult] = await Promise.all([
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
        projects!inner ( id, name, slug, organization_id )
      `,
      )
      .eq("projects.organization_id", organization.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name, slug")
      .eq("organization_id", organization.id)
      .order("name", { ascending: true }),
  ]);

  if (documentsResult.error || projectsResult.error) {
    console.error(
      "getDocumentsForCurrentOrganization failed",
      documentsResult.error?.message ?? projectsResult.error?.message,
    );
    return { kind: "error", message: "Could not load documents." };
  }

  const rows = (documentsResult.data ?? []) as DocumentRow[];
  const ownerIds = [
    ...new Set(rows.map((row) => row.owner_id).filter((id): id is string => Boolean(id))),
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

  const projects: DocumentProjectOption[] = (projectsResult.data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
  }));

  return {
    kind: "ok",
    documents: rows
      .map((row) => mapDocument(row, profiles))
      .filter((item): item is DocumentListItem => item !== null),
    projects,
    canWrite: writableRole(organization.role),
  };
}
