"use client";

import { Button } from "@/components/ui/button";
import { updateProfileAction, type ProfileState } from "@/lib/auth/actions";
import { useActionState } from "react";

const INITIAL: ProfileState = {};

export function ProfileForm({
  fullName,
  jobTitle,
}: {
  fullName: string;
  jobTitle: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, INITIAL);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <label className="block">
        <span className="text-sm text-muted">Full name</span>
        <input
          name="fullName"
          type="text"
          required
          defaultValue={fullName}
          className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-teal"
        />
      </label>
      <label className="block">
        <span className="text-sm text-muted">Job title</span>
        <input
          name="jobTitle"
          type="text"
          defaultValue={jobTitle ?? ""}
          className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-teal"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-critical" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p className="text-sm text-teal" role="status">
          Profile updated.
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
