"use client";

import { Button } from "@/components/ui/button";
import { archiveProjectAction, restoreProjectAction } from "@/lib/projects/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ArchiveProjectButton({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await archiveProjectAction(projectId);
      if (!result.ok) {
        setError(result.error ?? "Could not archive the project.");
        return;
      }
      router.refresh();
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Archive project
      </Button>
    );
  }

  return (
    <div className="max-w-md rounded-md border border-line bg-surface p-4">
      <p className="text-sm font-medium text-ink">Archive {projectName}?</p>
      <p className="mt-2 text-sm text-muted">
        The project leaves the active portfolio, map, reports and compare selection. Connection
        cases, requirements, documents and history stay intact. You can restore it later.
      </p>
      {error ? <p className="mt-2 text-sm text-critical">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={onConfirm}>
          {pending ? "Archiving…" : "Archive project"}
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function RestoreProjectButton({
  projectId,
}: {
  projectId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onRestore() {
    setError(null);
    startTransition(async () => {
      const result = await restoreProjectAction(projectId);
      if (!result.ok) {
        setError(result.error ?? "Could not restore the project.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <Button type="button" disabled={pending} onClick={onRestore}>
        {pending ? "Restoring…" : "Restore project"}
      </Button>
      {error ? <p className="mt-2 text-sm text-critical">{error}</p> : null}
    </div>
  );
}
