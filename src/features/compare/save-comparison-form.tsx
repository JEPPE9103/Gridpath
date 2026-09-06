"use client";

import { Button } from "@/components/ui/button";
import { savePortfolioComparison } from "@/lib/compare/actions";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function SaveComparisonForm({
  projectIds,
  disabled,
}: {
  projectIds: string[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setMessage(null);
        startTransition(async () => {
          const result = await savePortfolioComparison({ name, projectIds });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setMessage("Saved for the team.");
          setName("");
          router.push(`/compare/${result.comparisonId}`);
        });
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block text-xs text-muted">Save for the team</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Q4 Investment Review"
          disabled={disabled || pending || projectIds.length === 0}
          className="h-9 w-56 rounded-md border border-line bg-surface px-3 text-sm"
        />
      </label>
      <Button type="submit" disabled={disabled || pending || projectIds.length === 0 || !name.trim()}>
        {pending ? "Saving…" : "Save comparison"}
      </Button>
      {error ? <p className="basis-full text-xs text-critical">{error}</p> : null}
      {message ? <p className="basis-full text-xs text-teal">{message}</p> : null}
    </form>
  );
}
