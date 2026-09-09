export function canCreateOrEditOpportunities(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

export function canReadOpportunities(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "member" || role === "viewer";
}

export function canPromoteOpportunities(role: string | null | undefined): boolean {
  return canCreateOrEditOpportunities(role);
}
