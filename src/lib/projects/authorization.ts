export function canCreateOrEditProjects(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

export function canDeleteProjects(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}
