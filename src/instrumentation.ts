import { logError } from "@/lib/observability/log";

export async function register() {
  // Observability is env-gated. Structured logs always emit; Sentry only if SENTRY_DSN is set.
}

export function onRequestError(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown";
  const digest =
    error && typeof error === "object" && "digest" in error
      ? String((error as { digest?: string }).digest ?? "")
      : "";
  logError("server.request_error", { message, digest: digest || null });
}
