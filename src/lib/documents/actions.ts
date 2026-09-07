"use server";

import { getCurrentOrganization } from "@/lib/data/organization";
import { asSingle } from "@/lib/data/row-utils";
import {
  canChangeDocumentStatus,
  canDeleteDocuments,
  canUploadDocuments,
  documentHasStoredFile,
} from "@/lib/documents/authorization";
import {
  formatFileSize,
  validateDocumentUploadFile,
} from "@/lib/documents/file-types";
import {
  buildDocumentStoragePath,
  PROJECT_DOCUMENTS_BUCKET,
  storagePathBelongsToTenant,
} from "@/lib/documents/storage-path";
import {
  documentCategoryToDb,
  documentStatusLabel,
  documentStatusToDb,
  isDocumentCategory,
  isDocumentStatus,
} from "@/lib/domain/catalog-labels";
import { logError } from "@/lib/observability/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DocumentStatus } from "@/types";
import { revalidatePath } from "next/cache";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SIGNED_URL_SECONDS = 120;

type ProjectEmbed = {
  id: string;
  slug: string;
  organization_id: string;
};

type DocumentRecord = {
  id: string;
  name: string;
  status: string;
  project_id: string;
  storage_path: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  projects: ProjectEmbed | ProjectEmbed[] | null;
};

function revalidateDocumentPaths(projectSlug: string) {
  revalidatePath("/documents");
  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/projects/${projectSlug}/connection`);
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function storageErrorIsMissing(message: string | undefined): boolean {
  const text = (message ?? "").toLowerCase();
  return text.includes("not found") || text.includes("404") || text.includes("does not exist");
}

async function loadDocumentForOrganization(
  documentId: string,
  organizationId: string,
): Promise<
  | { ok: true; document: DocumentRecord; project: ProjectEmbed }
  | { ok: false }
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, name, status, project_id, storage_path, original_filename, mime_type, file_size_bytes, projects!inner ( id, slug, organization_id )",
    )
    .eq("id", documentId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      logError("documents.load_failed", { message: error.message });
    }
    return { ok: false };
  }

  const project = asSingle(data.projects as ProjectEmbed | ProjectEmbed[] | null);
  if (!project || project.organization_id !== organizationId) {
    return { ok: false };
  }

  return { ok: true, document: data as DocumentRecord, project };
}

export async function uploadProjectDocument(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const displayName = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const statusValue = String(formData.get("status") ?? "Draft").trim();
  const file = formData.get("file");

  if (!isUuid(projectId) || !isDocumentCategory(category)) {
    return { ok: false, error: "Could not upload the document." };
  }
  if (!isDocumentStatus(statusValue)) {
    return { ok: false, error: "Could not upload the document." };
  }
  if (!(file instanceof File)) {
    return { ok: false, error: "Choose a file to upload." };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canUploadDocuments(organization.role)) {
    return { ok: false, error: "You do not have permission to upload documents." };
  }

  const fileCheck = validateDocumentUploadFile({
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });
  if (!fileCheck.ok) {
    return { ok: false, error: fileCheck.error };
  }

  const name = (displayName || file.name.replace(/\.[^.]+$/, "") || file.name).slice(0, 200);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to upload a document." };
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, slug, organization_id")
    .eq("id", projectId)
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (projectError || !project) {
    if (projectError) {
      logError("documents.upload_project_load_failed", { message: projectError.message });
    }
    return { ok: false, error: "That project is not in this workspace." };
  }

  const { data: created, error: insertError } = await supabase
    .from("documents")
    .insert({
      project_id: project.id,
      owner_id: user.id,
      name,
      category: documentCategoryToDb(category),
      status: documentStatusToDb(statusValue),
    })
    .select("id")
    .maybeSingle();

  if (insertError || !created) {
    if (insertError) {
      logError("documents.upload_insert_failed", { message: insertError.message });
    }
    return { ok: false, error: "Could not save the document record." };
  }

  let storagePath: string;
  try {
    storagePath = buildDocumentStoragePath({
      organizationId: organization.id,
      projectId: project.id,
      documentId: created.id,
      originalFilename: file.name,
    });
  } catch (error) {
    logError("documents.upload_path_failed", {
      message: error instanceof Error ? error.message : "path failed",
    });
    await supabase.from("documents").delete().eq("id", created.id);
    return { ok: false, error: "Could not store the file." };
  }

  if (!storagePathBelongsToTenant(storagePath, organization.id, project.id)) {
    await supabase.from("documents").delete().eq("id", created.id);
    return { ok: false, error: "Could not store the file." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(PROJECT_DOCUMENTS_BUCKET)
    .upload(storagePath, bytes, {
      contentType: fileCheck.mimeType,
      upsert: false,
    });

  if (uploadError) {
    logError("documents.upload_storage_failed", { message: uploadError.message });
    await supabase.from("documents").delete().eq("id", created.id);
    return { ok: false, error: "Could not store the file." };
  }

  const uploadedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("documents")
    .update({
      storage_path: storagePath,
      original_filename: file.name.slice(0, 180),
      mime_type: fileCheck.mimeType,
      file_size_bytes: file.size,
      uploaded_by: user.id,
      uploaded_at: uploadedAt,
    })
    .eq("id", created.id)
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    if (updateError) {
      logError("documents.upload_metadata_failed", { message: updateError.message });
    }
    const { error: removeError } = await supabase.storage
      .from(PROJECT_DOCUMENTS_BUCKET)
      .remove([storagePath]);
    if (removeError) {
      logError("documents.upload_orphan_cleanup_failed", { message: removeError.message });
    }
    await supabase.from("documents").delete().eq("id", created.id);
    return { ok: false, error: "Could not finish saving the document." };
  }

  const { error: eventError } = await supabase.from("project_events").insert({
    project_id: project.id,
    title: "Document uploaded",
    detail: `${name} (${fileCheck.mimeType}, ${formatFileSize(file.size)})`,
    source: "Customer Data",
  });
  if (eventError) {
    logError("documents.upload_event_failed", { message: eventError.message });
  }

  revalidateDocumentPaths(project.slug);
  return { ok: true };
}

export async function getDocumentDownloadUrl(
  documentId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!isUuid(documentId)) {
    return { ok: false, error: "Could not open that document." };
  }

  const organization = await getCurrentOrganization();
  if (!organization) {
    return { ok: false, error: "Could not open that document." };
  }

  const loaded = await loadDocumentForOrganization(documentId, organization.id);
  if (!loaded.ok) {
    return { ok: false, error: "Could not open that document." };
  }

  if (!documentHasStoredFile(loaded.document.storage_path) || !loaded.document.storage_path) {
    return { ok: false, error: "This record has no stored file." };
  }

  if (
    !storagePathBelongsToTenant(
      loaded.document.storage_path,
      organization.id,
      loaded.project.id,
    )
  ) {
    return { ok: false, error: "Could not open that document." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from(PROJECT_DOCUMENTS_BUCKET)
    .createSignedUrl(loaded.document.storage_path, SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    if (error) {
      logError("documents.download_url_failed", { message: error.message });
    }
    return { ok: false, error: "Could not open that document." };
  }

  return { ok: true, url: data.signedUrl };
}

export async function deleteProjectDocument(
  documentId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isUuid(documentId)) {
    return { ok: false, error: "Could not delete the document." };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canDeleteDocuments(organization.role)) {
    return { ok: false, error: "You do not have permission to delete documents." };
  }

  const loaded = await loadDocumentForOrganization(documentId, organization.id);
  if (!loaded.ok) {
    return { ok: false, error: "Could not delete the document." };
  }

  const supabase = await createSupabaseServerClient();
  const storagePath = loaded.document.storage_path;

  if (documentHasStoredFile(storagePath) && storagePath) {
    if (!storagePathBelongsToTenant(storagePath, organization.id, loaded.project.id)) {
      return { ok: false, error: "Could not delete the document." };
    }
    const { error: removeError } = await supabase.storage
      .from(PROJECT_DOCUMENTS_BUCKET)
      .remove([storagePath]);
    if (removeError && !storageErrorIsMissing(removeError.message)) {
      logError("documents.delete_storage_failed", { message: removeError.message });
      return {
        ok: false,
        error: "The file could not be removed. The document record was left in place.",
      };
    }
  }

  const { error: eventError } = await supabase.from("project_events").insert({
    project_id: loaded.document.project_id,
    title: "Document deleted",
    detail: loaded.document.name,
    source: "Customer Data",
  });
  if (eventError) {
    logError("documents.delete_event_failed", { message: eventError.message });
  }

  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (deleteError) {
    logError("documents.delete_record_failed", { message: deleteError.message });
    return {
      ok: false,
      error: documentHasStoredFile(storagePath)
        ? "The file was removed, but the document record could not be deleted. Try again."
        : "Could not delete the document record.",
    };
  }

  revalidateDocumentPaths(loaded.project.slug);
  return { ok: true };
}

export async function updateDocumentStatus(
  documentId: string,
  status: DocumentStatus,
): Promise<{ ok: boolean; error?: string }> {
  if (!isUuid(documentId) || !isDocumentStatus(status)) {
    return { ok: false, error: "Could not update document." };
  }

  const organization = await getCurrentOrganization();
  if (!organization || !canChangeDocumentStatus(organization.role)) {
    return { ok: false, error: "Could not update document." };
  }

  const loaded = await loadDocumentForOrganization(documentId, organization.id);
  if (!loaded.ok) {
    return { ok: false, error: "Could not update document." };
  }

  const nextStatus = documentStatusToDb(status);
  if (loaded.document.status === nextStatus) {
    revalidateDocumentPaths(loaded.project.slug);
    return { ok: true };
  }

  const supabase = await createSupabaseServerClient();
  const { data: updated, error: updateError } = await supabase
    .from("documents")
    .update({ status: nextStatus })
    .eq("id", documentId)
    .select("id")
    .maybeSingle();

  if (updateError || !updated) {
    if (updateError) {
      logError("documents.status_update_failed", { message: updateError.message });
    }
    return { ok: false, error: "Could not update document." };
  }

  const { error: eventError } = await supabase.from("project_events").insert({
    project_id: loaded.document.project_id,
    title: "Document status updated",
    detail: `${loaded.document.name}: ${documentStatusLabel(loaded.document.status)} → ${status}`,
    source: "Customer Data",
  });
  if (eventError) {
    logError("documents.status_event_failed", { message: eventError.message });
  }

  revalidateDocumentPaths(loaded.project.slug);
  return { ok: true };
}
