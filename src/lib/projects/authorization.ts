export function canCreateOrEditProjects(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

export function canDeleteProjects(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

/** Matches private.can_write_organization / can_write_project_organization. */
export function canWriteWorkflow(role: string | null | undefined): boolean {
  return canCreateOrEditProjects(role);
}

/** Matches private.is_organization_admin / is_project_organization_admin. */
export function canAdminWorkflow(role: string | null | undefined): boolean {
  return canDeleteProjects(role);
}
