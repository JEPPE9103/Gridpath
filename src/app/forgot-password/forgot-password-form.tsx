"use client";

import { authInputClass, authSubmitClass } from "@/components/auth/auth-card";
import { requestPasswordReset, type ForgotPasswordState } from "@/lib/auth/actions";
import Link from "next/link";
import { useActionState } from "react";

const INITIAL: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, INITIAL);

  if (state.sent) {
    return (
      <div className="mt-6">
        <p className="text-sm text-muted">
          If an account exists for{" "}
          <span className="text-ink">{state.email ?? "that email"}</span>, you will receive a
          password reset link shortly. Check your inbox and spam folder.
        </p>
        <p className="mt-6 text-sm text-muted">
          <Link href="/login" className="font-medium text-teal hover:text-teal-dark">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-sm text-muted">Work email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className={authInputClass}
        />
        {state.fieldErrors?.email ? (
          <p className="mt-1 text-xs text-critical">{state.fieldErrors.email}</p>
        ) : null}
      </label>
      {state.error ? (
        <p className="text-sm text-critical" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={authSubmitClass}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="pt-2 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-teal hover:text-teal-dark">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
