import {
  hasPasswordRecoveryCookie,
  PASSWORD_RECOVERY_COOKIE,
  passwordRecoveryCookieAttributes,
} from "@/lib/auth/recovery";
import { cookies } from "next/headers";

export async function markPasswordRecoveryCookie(): Promise<void> {
  const store = await cookies();
  store.set(PASSWORD_RECOVERY_COOKIE, "1", passwordRecoveryCookieAttributes());
}

export async function clearPasswordRecoveryCookie(): Promise<void> {
  const store = await cookies();
  store.set(PASSWORD_RECOVERY_COOKIE, "", passwordRecoveryCookieAttributes(true));
}

export async function readPasswordRecoveryCookie(): Promise<boolean> {
  const store = await cookies();
  return hasPasswordRecoveryCookie(store.get(PASSWORD_RECOVERY_COOKIE)?.value);
}
