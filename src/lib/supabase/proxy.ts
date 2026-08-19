import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

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

  if (!user && isWorkspacePath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return applyCookies(supabaseResponse, NextResponse.redirect(loginUrl));
  }

  if (user && pathname === "/login") {
    const portfolioUrl = request.nextUrl.clone();
    portfolioUrl.pathname = "/portfolio";
    portfolioUrl.search = "";
    return applyCookies(supabaseResponse, NextResponse.redirect(portfolioUrl));
  }

  return supabaseResponse;
}
