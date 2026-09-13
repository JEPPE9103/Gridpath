import { isOrganizationId } from "@/lib/organization/active-org-cookie-constants";

/**
 * Workspace requests with a well-formed active-org cookie can skip the
 * full membership list used only to rewrite that cookie. Existence of any
 * membership is still checked separately. Layout remains the source of truth
 * for which organisation is active.
 */
export function workspaceCookieSatisfiesMembershipLookup(input: {
  pathnameIsWorkspace: boolean;
  cookieValue: string | null | undefined;
}): boolean {
  return input.pathnameIsWorkspace && isOrganizationId(input.cookieValue?.trim());
}
