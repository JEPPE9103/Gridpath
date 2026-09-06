export type IngestErrorClass =
  | "transient_fetch"
  | "source_format"
  | "database"
  | "already_running"
  | "ingest_error";

export function classifyIngestError(error: unknown): IngestErrorClass {
  const message = String(error instanceof Error ? error.message : error);
  if (/already_running|skipped_locked/i.test(message)) {
    return "already_running";
  }
  if (
    /failed to fetch|fetch failed|econnreset|etimedout|enotfound|network|timeout| 429 | 502 | 503 | 504 /i.test(
      message,
    )
  ) {
    return "transient_fetch";
  }
  if (/parse|xlsx|shapefile|invalid workbook|zip|schema|could not discover/i.test(message)) {
    return "source_format";
  }
  if (/postgres|database|sql|permission denied|connection terminated/i.test(message)) {
    return "database";
  }
  return "ingest_error";
}

export function shouldRetryIngestError(errorClass: IngestErrorClass): boolean {
  return errorClass === "transient_fetch" || errorClass === "database";
}

export function sanitizeIngestError(message: string | null | undefined): string {
  return String(message ?? "")
    .replace(/:\/\/[^/\s]+@/g, "://***@")
    .replace(/(service_role|eyJ[A-Za-z0-9_-]{20,})/g, "[redacted]")
    .slice(0, 280);
}

export async function withTransientRetries<T>(
  task: () => Promise<T>,
  {
    attempts = 3,
    label = "request",
  }: {
    attempts?: number;
    label?: string;
  } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      const errorClass = classifyIngestError(error);
      if (!shouldRetryIngestError(errorClass) || attempt === attempts) {
        throw error;
      }
      console.warn(
        JSON.stringify({
          event: "monitor.retry",
          label,
          attempt,
          attempts,
          errorClass,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw lastError;
}
