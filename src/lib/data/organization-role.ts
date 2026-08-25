export function organizationRoleLabel(role: string): string {
  if (role === "owner") {
    return "Owner";
  }
  if (role === "admin") {
    return "Admin";
  }
  if (role === "member") {
    return "Member";
  }
  if (role === "viewer") {
    return "Viewer";
  }
  return role;
}
