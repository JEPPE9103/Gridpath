"use client";

import { Button } from "@/components/ui/button";
import { DOCUMENT_CATEGORY_FILTERS, DOCUMENT_STATUS_FILTERS, type DocumentListCategory } from "@/lib/data/documents-types";
import { uploadProjectDocument } from "@/lib/documents/actions";
import { MAX_DOCUMENT_FILE_BYTES } from "@/lib/documents/file-types";
import type { DocumentStatus } from "@/types";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

type UploadState = "idle" | "uploading" | "success" | "error";

export function DocumentUploadForm({
  projects,
  defaultProjectId,
  compact = false,
}: {
  projects: Array<{ id: string; name: string }>;
  defaultProjectId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? "");
  const [category, setCategory] = useState<DocumentListCategory>("Technical");
  const [status, setStatus] = useState<DocumentStatus>("Draft");
  const [state, setState] = useState<UploadState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted">Add a project before uploading documents.</p>
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("projectId", projectId);
    data.set("name", name);
    data.set("category", category);
    data.set("status", status);
    setState("uploading");
    setMessage(null);
    startTransition(async () => {
      const result = await uploadProjectDocument(data);
      if (!result.ok) {
        setState("error");
        setMessage(result.error ?? "Could not upload the document.");
        return;
      }
      setState("success");
      setMessage("Document uploaded.");
      setName("");
      form.reset();
      router.refresh();
    });
  }

  return (
    <form
      className={
        compact
          ? "space-y-3 rounded-md border border-line bg-surface p-4"
          : "flex flex-wrap items-end gap-2 rounded-md border border-line bg-surface p-4"
      }
      onSubmit={onSubmit}
    >
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">File</span>
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.gif,application/pdf,image/*"
          className="block max-w-xs text-sm"
        />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Display name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Optional — defaults to file name"
          className="h-9 w-56 rounded-md border border-line px-3"
        />
      </label>
      {defaultProjectId ? null : (
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
      )}
      {defaultProjectId ? <input type="hidden" name="projectId" value={defaultProjectId} /> : null}
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Category</span>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as DocumentListCategory)}
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
          value={status}
          onChange={(event) => setStatus(event.target.value as DocumentStatus)}
          className="h-9 rounded-md border border-line bg-surface px-2"
        >
          {DOCUMENT_STATUS_FILTERS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <Button type="submit" disabled={pending || !projectId}>
        {pending || state === "uploading" ? "Uploading…" : "Upload document"}
      </Button>
      <p className="basis-full text-xs text-muted">
        Customer-provided files, stored privately. PDF, Word, Excel, CSV, and common images up to{" "}
        {Math.round(MAX_DOCUMENT_FILE_BYTES / (1024 * 1024))} MB. Files are not malware-scanned.
      </p>
      {state === "error" && message ? (
        <p className="basis-full text-sm text-critical" role="alert">
          {message}
        </p>
      ) : null}
      {state === "success" && message ? (
        <p className="basis-full text-sm text-teal" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
