"use client";

import { authSubmitClass } from "@/components/auth/auth-card";
import { acceptOrganizationInviteFormAction } from "@/lib/organization/invite-actions";
import type { InvitePreview } from "@/lib/data/invite";
import Link from "next/link";
import { useActionState } from "react";

function formatExpiry(value: string): string {
  return new Date(value).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function InviteAcceptPanel({
  token,
  preview,
  authenticatedEmail,
}: {
  token: string;
  preview: InvitePreview;
  authenticatedEmail: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    acceptOrganizationInviteFormAction.bind(null, token),
    {},
  );

  if (preview.status === "expired") {
    return (
      <p className="mt-4 text-sm text-muted">This invitation has expired.</p>
    );
  }

  if (preview.status === "revoked") {
    return (
      <p className="mt-4 text-sm text-muted">This invitation is no longer active.</p>
    );
  }

  if (preview.status === "accepted") {
    return (
      <p className="mt-4 text-sm text-muted">This invitation has already been used.</p>
    );
  }

  const emailMatches =
    authenticatedEmail !== null && authenticatedEmail === preview.inviteEmail.toLowerCase();
  const emailMismatch = authenticatedEmail !== null && !emailMatches;

  return (
    <div className="mt-6 space-y-4">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Workspace</dt>
          <dd className="text-right font-medium">{preview.organizationName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Role</dt>
          <dd className="text-right">{preview.inviteRoleLabel}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Invitation expires</dt>
          <dd className="text-right">{formatExpiry(preview.expiresAt)}</dd>
        </div>
      </dl>

      {!authenticatedEmail ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Sign in or create an account with <span className="text-ink">{preview.inviteEmail}</span>{" "}
            to accept this invitation.
          </p>
          <Link
            href={`/login?invite=${encodeURIComponent(token)}`}
            className={authSubmitClass}
          >
            Sign in to continue
          </Link>
          <p className="text-center text-sm text-muted">
            New to NOXHEIM?{" "}
            <Link
              href={`/signup?invite=${encodeURIComponent(token)}`}
              className="font-medium text-teal hover:text-teal-dark"
            >
              Create account
            </Link>
          </p>
        </div>
      ) : null}

      {emailMismatch ? (
        <div className="rounded-md border border-line bg-canvas p-4 text-sm">
          <p>
            This invitation was sent to{" "}
            <span className="font-medium text-ink">{preview.inviteEmail}</span>.
          </p>
          <p className="mt-2 text-muted">
            You are signed in as {authenticatedEmail}. Sign out and use the invited account to
            continue.
          </p>
          <Link
            href={`/login?invite=${encodeURIComponent(token)}`}
            className="mt-3 inline-block text-teal hover:text-teal-dark"
          >
            Use another account
          </Link>
        </div>
      ) : null}

      {authenticatedEmail && emailMatches ? (
        <form action={formAction}>
          {state.error ? (
            <p className="mb-3 text-sm text-critical" role="alert">
              {state.error}
            </p>
          ) : null}
          <button type="submit" disabled={pending} className={authSubmitClass}>
            {pending ? "Accepting invitation…" : "Accept invitation"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
