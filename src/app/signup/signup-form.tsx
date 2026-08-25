"use client";

import { AuthCard, authInputClass, authSubmitClass } from "@/components/auth/auth-card";
import { signUp, type SignupState } from "@/lib/auth/actions";
import Link from "next/link";
import { useActionState } from "react";

const INITIAL: SignupState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, INITIAL);
  const values = state.values;

  if (state.needsConfirmation) {
    return (
      <AuthCard title="Check your email">
        <p className="mt-3 text-sm text-muted">
          Check your email to confirm your account.
          {values?.email ? (
            <>
              {" "}
              We sent a message to <span className="text-ink">{values.email}</span>.
            </>
          ) : null}{" "}
          After you confirm, sign in to create your workspace.
        </p>
        <p className="mt-6 text-sm text-muted">
          Already confirmed?{" "}
          <Link href="/login" className="font-medium text-teal hover:text-teal-dark">
            Sign in
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create account">
      <form action={formAction} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-muted">Full name</span>
          <input
            name="fullName"
            type="text"
            autoComplete="name"
            required
            defaultValue={values?.fullName}
            className={authInputClass}
          />
          {state.fieldErrors?.fullName ? (
            <p className="mt-1 text-xs text-critical">{state.fieldErrors.fullName}</p>
          ) : null}
        </label>
        <label className="block">
          <span className="text-sm text-muted">Work email</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={values?.email}
            className={authInputClass}
          />
          {state.fieldErrors?.email ? (
            <p className="mt-1 text-xs text-critical">{state.fieldErrors.email}</p>
          ) : null}
        </label>
        <label className="block">
          <span className="text-sm text-muted">Job title (optional)</span>
          <input
            name="jobTitle"
            type="text"
            autoComplete="organization-title"
            defaultValue={values?.jobTitle}
            className={authInputClass}
          />
        </label>
        <label className="block">
          <span className="text-sm text-muted">Password</span>
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
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-teal hover:text-teal-dark">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
