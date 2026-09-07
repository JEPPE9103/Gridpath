export const PASSWORD_RECOVERY_COOKIE = "noxheim_password_recovery";

export function passwordRecoveryCookieAttributes(clearing = false) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: clearing ? 0 : 60 * 15,
  };
}

export function hasPasswordRecoveryCookie(
  value: string | null | undefined,
): boolean {
  return value === "1";
}
