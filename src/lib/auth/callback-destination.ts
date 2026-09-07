import { safeRedirectPath } from "@/lib/auth/redirect";
import { isInvitePath } from "@/lib/auth/routes";

export type AuthCallbackDestination = {
  path: string;
  recovery: boolean;
};

/**
 * Decide where /auth/callback should send the user after exchanging a code.
 * Recovery must never fall through to a workspace (including Sample/demo).
 */
export function resolveAuthCallbackDestination(input: {
  type: string | null;
  next: string | null;
}): AuthCallbackDestination {
  const type = (input.type ?? "").trim().toLowerCase();
  const nextPath = input.next ? safeRedirectPath(input.next, "") : "";

  if (type === "recovery" || nextPath === "/reset-password") {
    return { path: "/reset-password", recovery: true };
  }

  if (type === "invite" || (nextPath && isInvitePath(nextPath))) {
    return {
      path: nextPath && isInvitePath(nextPath) ? nextPath : "/onboarding",
      recovery: false,
    };
  }

  if (nextPath) {
    return { path: nextPath, recovery: false };
  }

  if (type === "signup" || type === "email" || type === "magiclink") {
    return { path: "/onboarding", recovery: false };
  }

  // Missing type+next: prefer dedicated recovery over a product workspace.
  return { path: "/reset-password", recovery: true };
}

export function authCallbackForwardSearch(input: {
  pathname: string;
  searchParams: URLSearchParams;
}): string | null {
  if (input.pathname === "/auth/callback") {
    return null;
  }

  const code = input.searchParams.get("code");
  const tokenHash = input.searchParams.get("token_hash");
  const type = input.searchParams.get("type");
  if (!code && !(tokenHash && type)) {
    return null;
  }

  const destination = resolveAuthCallbackDestination({
    type,
    next: input.searchParams.get("next"),
  });

  const params = new URLSearchParams();
  if (code) {
    params.set("code", code);
  }
  if (tokenHash) {
    params.set("token_hash", tokenHash);
  }
  if (type) {
    params.set("type", type);
  }
  params.set("next", destination.path);
  return `/auth/callback?${params.toString()}`;
}
