"use client";

import { authInputClass, authSubmitClass } from "@/components/auth/auth-card";
import { updatePasswordAfterRecovery, type ResetPasswordState } from "@/lib/auth/actions";
import Link from "next/link";
import { useActionState } from "react";

const INITIAL: ResetPasswordState = {};

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAfterRecovery, INITIAL);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm text-muted">New password</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className={authInputClass}
        />
        {state.fieldErrors?.password ? (
          <p className="mt-1 text-xs text-critical">{state.fieldErrors.password}</p>
        ) : null}
      </label>
      <label className="block">
        <span className="text-sm text-muted">Confirm password</span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          className={authInputClass}
        />
        {state.fieldErrors?.confirmPassword ? (
          <p className="mt-1 text-xs text-critical">{state.fieldErrors.confirmPassword}</p>
        ) : null}
      </label>
      {state.error ? (
        <p className="text-sm text-critical" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={authSubmitClass}>
        {pending ? "Saving…" : "Update password"}
      </button>
      <p className="pt-2 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-teal hover:text-teal-dark">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
