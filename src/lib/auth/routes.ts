/**
 * Path classifiers for auth and workspace routing.
 * Keep recovery (/reset-password) out of the authenticated product shell.
 */

const WORKSPACE_PREFIXES = [
  "/alerts",
  "/overview",
  "/portfolio",
  "/map",
  "/compare",
  "/connections",
  "/changes",
  "/documents",
  "/reports",
  "/projects",
  "/settings",
] as const;

export function isWorkspacePath(pathname: string): boolean {
  return WORKSPACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isInternalOperationsPath(pathname: string): boolean {
  return pathname === "/internal" || pathname.startsWith("/internal/");
}

export function isInvitePath(pathname: string): boolean {
  return pathname === "/invite" || pathname.startsWith("/invite/");
}

export function isAuthEntryPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup";
}

export function isAuthCallbackPath(pathname: string): boolean {
  return pathname === "/auth/callback";
}

export function isResetPasswordPath(pathname: string): boolean {
  return pathname === "/reset-password";
}

export function isForgotPasswordPath(pathname: string): boolean {
  return pathname === "/forgot-password";
}

export function isOnboardingPath(pathname: string): boolean {
  return pathname === "/onboarding";
}
