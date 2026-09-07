import { getPublicSiteUrl } from "@/lib/site-url";
import { isInvitePath } from "@/lib/auth/routes";

const ALLOWED_AUTH_NEXT_PATHS = new Set([
  "/reset-password",
  "/onboarding",
  "/portfolio",
  "/overview",
]);

/**
 * Restrict post-auth redirects to same-origin allowlisted paths.
 * Rejects open redirects and blocks sending recovery into an arbitrary workspace.
 */
export function isAllowedAuthNextPath(path: string): boolean {
  if (ALLOWED_AUTH_NEXT_PATHS.has(path)) {
    return true;
  }
  if (!path.startsWith("/invite/")) {
    return false;
  }
  const token = path.slice("/invite/".length);
  return token.length > 0 && !token.includes("/") && isInvitePath(path);
}

export function safeRedirectPath(
  next: string | null | undefined,
  fallback = "/onboarding",
): string {
  if (!next) {
    return fallback;
  }
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return fallback;
  }
  const pathOnly = next.split("?")[0]?.split("#")[0] ?? "";
  if (!isAllowedAuthNextPath(pathOnly)) {
    return fallback;
  }
  return pathOnly;
}

export function authCallbackUrl(nextPath: string): string {
  const next = encodeURIComponent(safeRedirectPath(nextPath, "/reset-password"));
  return `${getPublicSiteUrl()}/auth/callback?next=${next}`;
}
