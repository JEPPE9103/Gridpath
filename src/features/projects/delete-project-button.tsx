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
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirmed = confirmation.trim() === projectName;

  function onConfirm() {
    if (!confirmed) {
      return;
    }
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
      <Button type="button" variant="ghost" className="text-critical" onClick={() => setOpen(true)}>
        Permanently delete
      </Button>
    );
  }

  return (
    <div className="max-w-md rounded-md border border-critical/30 bg-critical-bg p-4">
      <p className="text-sm font-medium text-ink">Permanently delete {projectName}?</p>
      <p className="mt-2 text-sm text-muted">
        This is not the normal way to remove a project from the portfolio. Archive instead unless
        you intend to destroy the record. Hard delete removes the project and its associated site,
        connection case, requirements, document records, project events and project-linked change
        impacts. Organisation alerts stay, with the project link cleared. Official Ei sources, grid
        areas, observations and external changes are not deleted.
      </p>
      <label className="mt-3 block text-sm">
        <span className="text-muted">Type the project name to confirm</span>
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="mt-1 h-9 w-full rounded-md border border-line bg-canvas px-3 text-sm text-ink"
          autoComplete="off"
        />
      </label>
      {error ? <p className="mt-2 text-sm text-critical">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="danger" disabled={pending || !confirmed} onClick={onConfirm}>
          {pending ? "Deleting…" : "Permanently delete project"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setConfirmation("");
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
