import { AuthCard } from "@/components/auth/auth-card";
import { InviteAcceptPanel } from "@/features/invite/invite-accept-panel";
import { getAuthenticatedUserEmail } from "@/lib/organization/invite-actions";
import { getOrganizationInvitePreview } from "@/lib/data/invite";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Workspace invitation" };

type InvitePageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;
  const [previewResult, authenticatedEmail] = await Promise.all([
    getOrganizationInvitePreview(token),
    getAuthenticatedUserEmail(),
  ]);

  if (previewResult.kind === "error") {
    return (
      <AuthCard title="Invitation unavailable">
        <p className="mt-3 text-sm text-muted">{previewResult.message}</p>
      </AuthCard>
    );
  }

  if (previewResult.kind === "not_found") {
    return (
      <AuthCard title="Invitation unavailable">
        <p className="mt-3 text-sm text-muted">This invitation is not valid.</p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="You've been invited">
      <p className="mt-2 text-sm text-muted">Join a workspace on NOXHEIM.</p>
      <InviteAcceptPanel
        token={token}
        preview={previewResult.preview}
        authenticatedEmail={authenticatedEmail}
      />
    </AuthCard>
  );
}
