"use client";

import { Button } from "@/components/ui/button";
import type { PendingInviteItem, TeamMemberItem } from "@/lib/data/team";
import {
  changeOrganizationMemberRoleAction,
  createOrganizationInviteAction,
  removeOrganizationMemberAction,
  revokeOrganizationInviteAction,
  type TeamActionState,
} from "@/lib/organization/team-actions";
import {
  inviteableRoles,
  manageableRoles,
} from "@/lib/organization/team-permissions";
import { organizationRoleLabel } from "@/lib/data/organization-role";
import { useActionState, useState, useTransition } from "react";

const INITIAL_TEAM_STATE: TeamActionState = {};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("sv-SE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function InviteTeammateForm({ actorRole }: { actorRole: string }) {
  const [state, formAction, pending] = useActionState(
    createOrganizationInviteAction,
    INITIAL_TEAM_STATE,
  );
  const roles = inviteableRoles(actorRole);

  return (
    <div className="mt-4 rounded-md border border-line bg-canvas p-4">
      <h3 className="text-sm font-semibold">Invite teammate</h3>
      <form action={formAction} className="mt-3 space-y-3">
        <label className="block">
          <span className="text-sm text-muted">Work email</span>
          <input
            name="email"
            type="email"
            required
            className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-teal"
          />
        </label>
        <label className="block">
          <span className="text-sm text-muted">Role</span>
          <select
            name="role"
            defaultValue="member"
            className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-teal"
          >
            {roles.map((role) => (
              <option key={role} value={role}>
                {organizationRoleLabel(role)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            Owners and Admins can manage projects. Members can edit workflow. Viewers are
            read-only.
          </p>
        </label>
        {state.error ? (
          <p className="text-sm text-critical" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="text-sm text-teal" role="status">
            {state.success}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Creating invitation…" : "Create invitation"}
        </Button>
      </form>
      {state.inviteUrl ? (
        <div className="mt-3 rounded-md border border-line bg-surface p-3">
          <p className="text-xs text-muted">Copy invite link</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={state.inviteUrl}
              className="h-10 min-w-0 flex-1 rounded-md border border-line bg-canvas px-3 text-xs text-ink"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(state.inviteUrl ?? "");
              }}
            >
              Copy invite link
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Email delivery is not configured yet. Share this link securely with your teammate.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function MemberActions({
  member,
  actorRole,
  currentUserId,
}: {
  member: TeamMemberItem;
  actorRole: string;
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const roles = manageableRoles(actorRole, member.role);
  const isSelf = member.profileId === currentUserId;

  if (isSelf || roles.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <select
          defaultValue={member.role}
          disabled={pending}
          className="h-8 rounded-md border border-line bg-surface px-2 text-xs text-ink"
          onChange={(event) => {
            const newRole = event.target.value;
            if (newRole === member.role) {
              return;
            }
            if (
              !window.confirm(
                `Change ${member.fullName}'s role to ${organizationRoleLabel(newRole)}?`,
              )
            ) {
              event.target.value = member.role;
              return;
            }
            startTransition(async () => {
              const result = await changeOrganizationMemberRoleAction(member.profileId, newRole);
              setMessage(result.error ?? result.success ?? null);
            });
          }}
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {organizationRoleLabel(role)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Remove ${member.fullName} from this workspace?`)) {
              return;
            }
            startTransition(async () => {
              const result = await removeOrganizationMemberAction(member.profileId);
              setMessage(result.error ?? result.success ?? null);
            });
          }}
        >
          Remove
        </Button>
      </div>
      {message ? <p className="text-xs text-muted">{message}</p> : null}
    </div>
  );
}

function PendingInviteRow({
  invite,
  canManage,
}: {
  invite: PendingInviteItem;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <tr className="border-t border-line">
      <td className="px-3 py-3 text-sm">{invite.email}</td>
      <td className="px-3 py-3 text-sm">{invite.roleLabel}</td>
      <td className="px-3 py-3 text-sm text-muted">{invite.invitedByName}</td>
      <td className="px-3 py-3 text-sm text-muted">{formatDate(invite.expiresAt)}</td>
      <td className="px-3 py-3 text-sm capitalize">{invite.status}</td>
      <td className="px-3 py-3 text-right">
        {canManage && invite.status === "pending" ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Revoke the invitation for ${invite.email}?`)) {
                return;
              }
              startTransition(async () => {
                const result = await revokeOrganizationInviteAction(invite.inviteId);
                setMessage(result.error ?? result.success ?? null);
              });
            }}
          >
            Revoke
          </Button>
        ) : null}
        {message ? <p className="mt-1 text-xs text-muted">{message}</p> : null}
      </td>
    </tr>
  );
}

export function TeamSection({
  members,
  pendingInvites,
  canManageTeam,
  memberCount,
  organizationName,
  actorRole,
  currentUserId,
}: {
  members: TeamMemberItem[];
  pendingInvites: PendingInviteItem[];
  canManageTeam: boolean;
  memberCount: number;
  organizationName: string;
  actorRole: string;
  currentUserId: string;
}) {
  const activePending = pendingInvites.filter((invite) => invite.status === "pending");

  return (
    <section className="max-w-3xl rounded-md border border-line bg-surface p-5">
      <h2 className="text-base font-semibold">Team</h2>
      <p className="mt-1 text-sm text-muted">
        Manage who can access {organizationName}.
      </p>

      <div className="mt-4 overflow-x-auto rounded-md border border-line">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Joined</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.membershipId} className="border-t border-line">
                <td className="px-3 py-3">
                  <div className="font-medium">{member.fullName}</div>
                  {member.jobTitle ? (
                    <div className="text-xs text-muted">{member.jobTitle}</div>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-muted">{member.email}</td>
                <td className="px-3 py-3">{member.roleLabel}</td>
                <td className="px-3 py-3 text-muted">{formatDate(member.joinedAt)}</td>
                <td className="px-3 py-3">
                  {canManageTeam ? (
                    <MemberActions
                      member={member}
                      actorRole={actorRole}
                      currentUserId={currentUserId}
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {memberCount === 1 ? (
        <p className="mt-3 text-sm text-muted">You&apos;re the only member of this workspace.</p>
      ) : null}

      {canManageTeam ? <InviteTeammateForm actorRole={actorRole} /> : null}

      {canManageTeam ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Pending invitations</h3>
          {activePending.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No pending invitations.</p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-md border border-line">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-canvas text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Invited by</th>
                    <th className="px-3 py-2 font-medium">Expires</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvites.map((invite) => (
                    <PendingInviteRow
                      key={invite.inviteId}
                      invite={invite}
                      canManage={canManageTeam}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
