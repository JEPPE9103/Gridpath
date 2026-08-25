"use client";

import { signIn } from "@/lib/auth/actions";
import Link from "next/link";
import { useActionState } from "react";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(signIn, null);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <label className="block">
        <span className="text-sm text-muted">Work email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-teal"
        />
      </label>
      <label className="block">
        <span className="text-sm text-muted">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-teal"
        />
      </label>
      {error ? (
        <p className="text-sm text-critical" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="flex h-10 w-full items-center justify-center rounded-md bg-teal text-sm font-medium text-white hover:bg-teal-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="pt-2 text-center text-sm text-muted">
        No account yet?{" "}
        <Link href="/signup" className="font-medium text-teal hover:text-teal-dark">
          Create account
        </Link>
      </p>
    </form>
  );
}
