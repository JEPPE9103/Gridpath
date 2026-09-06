const SECRET_PATTERN =
  /(service_role|eyJ[A-Za-z0-9_-]{20,}|postgres:\/\/[^/\s]+|Bearer\s+[A-Za-z0-9._-]+)/gi;

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "password",
  "token",
  "secret",
  "apikey",
  "api_key",
  "service_role",
  "email_body",
  "document_content",
  "file_bytes",
]);

export function createRunId(prefix = "run"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(SECRET_PATTERN, "[redacted]").slice(0, 500);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(redactValue);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        out[key] = "[redacted]";
      } else {
        out[key] = redactValue(nested);
      }
    }
    return out;
  }
  return value;
}

function emit(level: "info" | "error", event: string, payload: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...((redactValue(payload) as Record<string, unknown>) ?? {}),
  });
  if (level === "error") {
    console.error(line);
  } else {
    console.info(line);
  }
}

export function logEvent(event: string, payload: Record<string, unknown> = {}) {
  emit("info", event, payload);
}

export function logError(event: string, payload: Record<string, unknown> = {}) {
  emit("error", event, payload);
  void captureOptionalSentry(event, payload);
}

async function captureOptionalSentry(event: string, payload: Record<string, unknown>) {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn || process.env.SENTRY_ENABLED === "false") {
    return;
  }
  try {
    const parsed = new URL(dsn);
    const publicKey = parsed.username;
    const projectId = parsed.pathname.replace(/^\//, "");
    if (!publicKey || !projectId) {
      return;
    }
    const storeUrl = `${parsed.protocol}//${parsed.host}/api/${projectId}/store/`;
    await fetch(storeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=noxheim-v1/1.0`,
      },
      body: JSON.stringify({
        message: event,
        level: "error",
        extra: redactValue(payload),
        tags: { app: "noxheim" },
      }),
    });
  } catch {
    // Structured logs remain the fallback. Never throw from logging.
  }
}
