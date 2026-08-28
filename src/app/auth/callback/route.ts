import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicSiteUrl } from "@/lib/site-url";
import { safeRedirectPath } from "@/lib/auth/redirect";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

function resetPasswordRedirect(reason: "expired" | "invalid" | "rate_limit"): NextResponse {
  const siteUrl = getPublicSiteUrl();
  return NextResponse.redirect(`${siteUrl}/reset-password?state=${reason}`);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const siteUrl = getPublicSiteUrl();
  const next = safeRedirectPath(searchParams.get("next"), "/reset-password");

  const error = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  if (error || errorCode) {
    if (errorCode === "otp_expired" || errorCode === "flow_state_expired") {
      return resetPasswordRedirect("expired");
    }
    if (errorCode === "over_request_rate_limit") {
      return resetPasswordRedirect("rate_limit");
    }
    return resetPasswordRedirect("invalid");
  }

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!code && !(tokenHash && type)) {
    return resetPasswordRedirect("invalid");
  }

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error("auth callback exchange failed", exchangeError.message);
      const reason =
        exchangeError.message.toLowerCase().includes("expired") ||
        exchangeError.message.toLowerCase().includes("otp")
          ? "expired"
          : "invalid";
      return resetPasswordRedirect(reason);
    }
  } else if (tokenHash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (verifyError) {
      console.error("auth callback verify failed", verifyError.message);
      const reason = verifyError.message.toLowerCase().includes("expired")
        ? "expired"
        : "invalid";
      return resetPasswordRedirect(reason);
    }
  }

  return NextResponse.redirect(`${siteUrl}${next}`);
}
