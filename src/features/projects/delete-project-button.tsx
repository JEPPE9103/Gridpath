"use client";

import { Button } from "@/components/ui/button";
import { deleteProjectAction } from "@/lib/projects/actions";
import { useState, useTransition } from "react";

export function DeleteProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteProjectAction(projectId);
      if (result && !result.ok) {
        setError(result.error ?? "Could not delete the project.");
      }
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        Delete project
      </Button>
    );
  }

  return (
    <div className="max-w-md rounded-md border border-critical/30 bg-critical-bg p-4">
      <p className="text-sm font-medium text-ink">Delete {projectName}?</p>
      <p className="mt-2 text-sm text-muted">
        This permanently removes the project and its associated site, connection case,
        requirements, document records, project events and project-linked change impacts.
        Organisation alerts stay, with the project link cleared. Official Ei sources, grid
        areas, observations and external changes are not deleted.
      </p>
      {error ? <p className="mt-2 text-sm text-critical">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="danger" disabled={pending} onClick={onConfirm}>
          {pending ? "Deleting…" : "Delete project"}
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
