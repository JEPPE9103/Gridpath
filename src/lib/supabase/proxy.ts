import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { SupabaseClient } from "@supabase/supabase-js";

const WORKSPACE_PREFIXES = [
  "/overview",
  "/portfolio",
  "/map",
  "/connections",
  "/changes",
  "/documents",
  "/reports",
  "/projects",
  "/settings",
];

function isWorkspacePath(pathname: string): boolean {
  return WORKSPACE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isAuthEntryPath(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup";
}

function isAuthCallbackPath(pathname: string): boolean {
  return pathname === "/auth/callback";
}

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
  const hasOrganization = user
    && (isWorkspacePath(pathname) || isAuthEntryPath(pathname) || pathname === "/onboarding")
    ? await userHasOrganization(supabase, user.id)
    : false;

  if (!user && (isWorkspacePath(pathname) || pathname === "/onboarding")) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return applyCookies(supabaseResponse, NextResponse.redirect(loginUrl));
  }

  if (isAuthCallbackPath(pathname)) {
    return supabaseResponse;
  }

  if (user && isAuthEntryPath(pathname)) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = hasOrganization ? "/portfolio" : "/onboarding";
    nextUrl.search = "";
    return applyCookies(supabaseResponse, NextResponse.redirect(nextUrl));
  }

  if (user && pathname === "/forgot-password") {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = hasOrganization ? "/portfolio" : "/onboarding";
    nextUrl.search = "";
    return applyCookies(supabaseResponse, NextResponse.redirect(nextUrl));
  }

  if (user && isWorkspacePath(pathname) && !hasOrganization) {
    const onboardingUrl = request.nextUrl.clone();
    onboardingUrl.pathname = "/onboarding";
    onboardingUrl.search = "";
    return applyCookies(supabaseResponse, NextResponse.redirect(onboardingUrl));
  }

  if (user && pathname === "/onboarding" && hasOrganization) {
    const portfolioUrl = request.nextUrl.clone();
    portfolioUrl.pathname = "/portfolio";
    portfolioUrl.search = "";
    return applyCookies(supabaseResponse, NextResponse.redirect(portfolioUrl));
  }

  return supabaseResponse;
}
