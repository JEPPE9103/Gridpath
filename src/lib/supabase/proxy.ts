import { authCallbackForwardSearch } from "@/lib/auth/callback-destination";
import { resolveAuthNavigation } from "@/lib/auth/navigation";
import {
  hasPasswordRecoveryCookie,
  PASSWORD_RECOVERY_COOKIE,
  passwordRecoveryCookieAttributes,
} from "@/lib/auth/recovery";
import { isWorkspacePath } from "@/lib/auth/routes";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  activeOrganizationCookieAttributes,
  isOrganizationId,
} from "@/lib/organization/active-org-cookie-constants";
import { resolveActiveOrganizationId } from "@/lib/organization/active-org-resolve";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { SupabaseClient } from "@supabase/supabase-js";

async function userHasOrganization(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("profile_id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("userHasOrganization failed", error.message);
    return false;
  }

  return Boolean(data);
}

async function syncActiveOrganizationCookieOnResponse(
  request: NextRequest,
  response: NextResponse,
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const cookieOrganizationId = isOrganizationId(
    request.cookies.get(ACTIVE_ORGANIZATION_COOKIE)?.value?.trim(),
  )
    ? (request.cookies.get(ACTIVE_ORGANIZATION_COOKIE)?.value?.trim() ?? null)
    : null;

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, created_at")
    .eq("profile_id", userId)
    .order("created_at", { ascending: true });

  if (error || !data?.length) {
    if (error) {
      console.error("syncActiveOrganizationCookieOnResponse failed", error.message);
    }
    return;
  }

  const memberships = data.map((row) => ({
    organizationId: row.organization_id as string,
    createdAt: row.created_at as string,
  }));

  const activeOrganizationId = resolveActiveOrganizationId(
    memberships,
    cookieOrganizationId,
  );

  if (!activeOrganizationId || cookieOrganizationId === activeOrganizationId) {
    return;
  }

  response.cookies.set(
    ACTIVE_ORGANIZATION_COOKIE,
    activeOrganizationId,
    activeOrganizationCookieAttributes(),
  );
}

function applyCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  for (const header of ["cache-control", "expires", "pragma"] as const) {
    const value = from.headers.get(header);
    if (value) {
      to.headers.set(header, value);
    }
  }
  return to;
}

export async function updateSession(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/internal/")) {
    return NextResponse.next({ request });
  }

  const forwarded = authCallbackForwardSearch({
    pathname: request.nextUrl.pathname,
    searchParams: request.nextUrl.searchParams,
  });
  if (forwarded) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    callbackUrl.search = forwarded.slice("/auth/callback".length);
    return NextResponse.redirect(callbackUrl);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const { url, key } = getSupabaseEnv();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([headerName, headerValue]) => {
          supabaseResponse.headers.set(headerName, headerValue);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isRecovery = hasPasswordRecoveryCookie(
    request.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value,
  );
  if (!user && isRecovery) {
    supabaseResponse.cookies.set(
      PASSWORD_RECOVERY_COOKIE,
      "",
      passwordRecoveryCookieAttributes(true),
    );
  }
  const needsMembershipLookup =
    Boolean(user) &&
    !isRecovery &&
    (isWorkspacePath(pathname) ||
      pathname === "/login" ||
      pathname === "/signup" ||
      pathname === "/forgot-password" ||
      pathname === "/onboarding");
  const hasOrganization = user && needsMembershipLookup
    ? await userHasOrganization(supabase, user.id)
    : false;

  const decision = resolveAuthNavigation({
    pathname,
    hasUser: Boolean(user),
    hasOrganization,
    isRecovery,
  });

  if (decision.type === "redirect") {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = decision.pathname;
    nextUrl.search = "";
    const redirectResponse = applyCookies(
      supabaseResponse,
      NextResponse.redirect(nextUrl),
    );
    if (user && !isRecovery && decision.pathname === "/portfolio") {
      await syncActiveOrganizationCookieOnResponse(
        request,
        redirectResponse,
        supabase,
        user.id,
      );
    }
    return redirectResponse;
  }

  if (user && !isRecovery && isWorkspacePath(pathname)) {
    await syncActiveOrganizationCookieOnResponse(
      request,
      supabaseResponse,
      supabase,
      user.id,
    );
  }

  return supabaseResponse;
}
