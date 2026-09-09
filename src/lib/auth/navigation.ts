import { POST_AUTH_HOME } from "@/lib/auth/paths";
import {
  isAuthCallbackPath,
  isAuthEntryPath,
  isForgotPasswordPath,
  isInternalOperationsPath,
  isInvitePath,
  isOnboardingPath,
  isResetPasswordPath,
  isWorkspacePath,
} from "@/lib/auth/routes";

export type AuthNavigation =
  | { type: "allow" }
  | { type: "redirect"; pathname: string };

/**
 * Deterministic auth/workspace navigation. Recovery sessions must stay on
 * /reset-password until the password is updated — never a workspace or demo.
 */
export function resolveAuthNavigation(input: {
  pathname: string;
  hasUser: boolean;
  hasOrganization: boolean;
  isRecovery: boolean;
}): AuthNavigation {
  const { pathname, hasUser, hasOrganization, isRecovery } = input;

  if (isAuthCallbackPath(pathname) || isInvitePath(pathname)) {
    return { type: "allow" };
  }

  // Recovery cookie only constrains a live recovery session. A stale cookie
  // without a user must not trap /forgot-password or /login.
  if (isRecovery && hasUser) {
    if (isResetPasswordPath(pathname)) {
      return { type: "allow" };
    }
    return { type: "redirect", pathname: "/reset-password" };
  }

  if (
    !hasUser &&
    (isWorkspacePath(pathname) || isOnboardingPath(pathname) || isInternalOperationsPath(pathname))
  ) {
    return { type: "redirect", pathname: "/login" };
  }

  if (hasUser && (isAuthEntryPath(pathname) || isForgotPasswordPath(pathname))) {
    return { type: "redirect", pathname: hasOrganization ? POST_AUTH_HOME : "/onboarding" };
  }

  if (hasUser && isWorkspacePath(pathname) && !hasOrganization) {
    return { type: "redirect", pathname: "/onboarding" };
  }

  if (hasUser && isOnboardingPath(pathname) && hasOrganization) {
    return { type: "redirect", pathname: POST_AUTH_HOME };
  }

  return { type: "allow" };
}
