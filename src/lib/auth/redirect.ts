import { getPublicSiteUrl } from "@/lib/site-url";

/**
 * Restrict post-auth redirects to same-origin relative paths.
 */
export function safeRedirectPath(
  next: string | null | undefined,
  fallback = "/portfolio",
): string {
  if (!next) {
    return fallback;
  }
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return fallback;
  }
  return next;
}

export function authCallbackUrl(nextPath: string): string {
  const next = encodeURIComponent(safeRedirectPath(nextPath, "/reset-password"));
  return `${getPublicSiteUrl()}/auth/callback?next=${next}`;
}
