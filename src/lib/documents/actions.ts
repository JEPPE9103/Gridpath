"use server";

import { getCurrentOrganization } from "@/lib/data/organization";
import { asSingle } from "@/lib/data/row-utils";
import {
  documentCategoryToDb,
  documentStatusLabel,
  documentStatusToDb,
  isDocumentCategory,
  isDocumentStatus,
} from "@/lib/domain/catalog-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DocumentCategory, DocumentStatus } from "@/types";
import { revalidatePath } from "next/cache";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function canWrite(role: string): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

type ProjectEmbed = {
  id: string;
  slug: string;
  organization_id: string;
};

function revalidateDocumentPaths(projectSlug: string) {
  revalidatePath("/documents");
  revalidatePath(`/projects/${projectSlug}`);
}

export async function createDocumentRecord(input: {
  name: string;
  projectId: string;
  category: DocumentCategory | "Other";
  status?: DocumentStatus;
}): Promise<{ ok: boolean; error?: string }> {
  const name = input.name.trim();
  if (
    name.length < 1 ||
    name.length > 200 ||
    !UUID_PATTERN.test(input.projectId) ||
    !isDocumentCategory(input.category)
  ) {
    return { ok: false, error: "Could not create document record." };
  }

  const status = input.status ?? "Missing";
  if (!isDocumentStatus(status)) {
    return { ok: false, error: "Could not create document record." };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canWrite(organization.role)) {
    return { ok: false, error: "Could not create document record." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Could not create document record." };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, slug, organization_id")
    .eq("id", input.projectId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (projectError || !project) {
    if (projectError) {
      console.error("createDocumentRecord project load failed", projectError.message);
    }
    return { ok: false, error: "Could not create document record." };
  }

  const { data: created, error: insertError } = await supabase
    .from("documents")
    .insert({
      project_id: project.id,
      owner_id: user.id,
      name,
      category: documentCategoryToDb(input.category),
      status: documentStatusToDb(status),
    })
    .select("id")
    .maybeSingle();

  if (insertError || !created) {
    if (insertError) {
      console.error("createDocumentRecord insert failed", insertError.message);
    }
    return { ok: false, error: "Could not create document record." };
  }

  revalidateDocumentPaths(project.slug);
  return { ok: true };
}

export async function updateDocumentStatus(
  documentId: string,
  status: DocumentStatus,
): Promise<{ ok: boolean; error?: string }> {
  if (!UUID_PATTERN.test(documentId) || !isDocumentStatus(status)) {
    return { ok: false, error: "Could not update document." };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canWrite(organization.role)) {
    return { ok: false, error: "Could not update document." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error: loadError } = await supabase
    .from("documents")
    .select("id, name, status, project_id, projects!inner ( id, slug, organization_id )")
    .eq("id", documentId)
    .maybeSingle();

  if (loadError || !data) {
    if (loadError) {
      console.error("updateDocumentStatus load failed", loadError.message);
    }
    return { ok: false, error: "Could not update document." };
  }

  const project = asSingle(data.projects as ProjectEmbed | ProjectEmbed[] | null);
  if (!project || project.organization_id !== organization.id) {
    return { ok: false, error: "Could not update document." };
  }

  const nextStatus = documentStatusToDb(status);
  if (data.status === nextStatus) {
    revalidateDocumentPaths(project.slug);
    return { ok: true };
  }

  const { data: updated, error: updateError } = await supabase
    .from("documents")
    .update({ status: nextStatus })
    .eq("id", documentId)
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    if (updateError) {
      console.error("updateDocumentStatus update failed", updateError.message);
    }
    return { ok: false, error: "Could not update document." };
  }

  const { error: eventError } = await supabase.from("project_events").insert({
    project_id: data.project_id,
    title: "Document status updated",
    detail: `${data.name}: ${documentStatusLabel(data.status)} → ${status}`,
    source: "Customer Data",
  });
  if (eventError) {
    console.error("updateDocumentStatus event failed", eventError.message);
  }

  revalidateDocumentPaths(project.slug);
  return { ok: true };
}
