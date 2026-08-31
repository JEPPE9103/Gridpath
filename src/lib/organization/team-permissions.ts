export type OrganizationRole = "owner" | "admin" | "member" | "viewer";

const ROLES: OrganizationRole[] = ["owner", "admin", "member", "viewer"];

export function isOrganizationRole(value: string): value is OrganizationRole {
  return ROLES.includes(value as OrganizationRole);
}

export function canInviteRole(
  actorRole: string | null | undefined,
  inviteRole: string,
): boolean {
  if (!isOrganizationRole(inviteRole)) {
    return false;
  }
  if (actorRole === "owner") {
    return true;
  }
  if (actorRole === "admin") {
    return inviteRole === "member" || inviteRole === "viewer";
  }
  return false;
}

export function canManageTeam(actorRole: string | null | undefined): boolean {
  return actorRole === "owner" || actorRole === "admin";
}

export function canManageTargetMember(
  actorRole: string | null | undefined,
  targetRole: string,
): boolean {
  if (actorRole === "owner") {
    return isOrganizationRole(targetRole);
  }
  if (actorRole === "admin") {
    return targetRole === "member" || targetRole === "viewer";
  }
  return false;
}

export function canAssignMemberRole(
  actorRole: string | null | undefined,
  targetRole: string,
  newRole: string,
): boolean {
  if (!isOrganizationRole(newRole)) {
    return false;
  }
  if (actorRole === "owner") {
    return true;
  }
  if (actorRole === "admin") {
    return (
      (targetRole === "member" || targetRole === "viewer") &&
      (newRole === "member" || newRole === "viewer")
    );
  }
  return false;
}

export function inviteableRoles(actorRole: string | null | undefined): OrganizationRole[] {
  if (actorRole === "owner") {
    return ["owner", "admin", "member", "viewer"];
  }
  if (actorRole === "admin") {
    return ["member", "viewer"];
  }
  return [];
}

export function manageableRoles(
  actorRole: string | null | undefined,
  targetRole: string,
): OrganizationRole[] {
  if (!canManageTargetMember(actorRole, targetRole)) {
    return [];
  }
  if (actorRole === "owner") {
    return ["owner", "admin", "member", "viewer"];
  }
  if (actorRole === "admin") {
    return ["member", "viewer"];
  }
  return [];
}

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidInviteEmail(email: string): boolean {
  const normalized = normalizeInviteEmail(email);
  return normalized.length > 0 && normalized.includes("@") && !normalized.includes(" ");
}
