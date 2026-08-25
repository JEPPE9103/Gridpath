"use client";

import { AuthCard, authInputClass, authSubmitClass } from "@/components/auth/auth-card";
import { createWorkspaceAction, signOut, type WorkspaceState } from "@/lib/auth/actions";
import { useActionState } from "react";

const INITIAL: WorkspaceState = {};

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createWorkspaceAction, INITIAL);

  return (
    <AuthCard title="Create workspace">
      <p className="mt-2 text-sm text-muted">
        Add your company to start an empty NOXHEIM portfolio.
      </p>
      <form action={formAction} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-muted">Company / organization name</span>
          <input
            name="companyName"
            type="text"
            required
            defaultValue={state.companyName}
            placeholder="Nordic Battery Development AB"
            className={authInputClass}
          />
        </label>
        {state.error ? (
          <p className="text-sm text-critical" role="alert">
            {state.error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className={authSubmitClass}>
          {pending ? "Creating workspace…" : "Create workspace"}
        </button>
      </form>
      <form action={signOut} className="mt-6">
        <button type="submit" className="text-sm text-muted hover:text-ink">
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}
