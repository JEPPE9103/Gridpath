import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRunId, redactValue } from "@/lib/observability/log";

describe("observability redaction", () => {
  it("redacts tokens, service role fragments, and sensitive keys", () => {
    const redacted = redactValue({
      authorization: "Bearer super-secret",
      message: "postgres://user:hunter2@db.example/postgres service_role eyJhbGciOi-not-a-real-token-value-xx",
      document_content: "customer file bytes",
    }) as Record<string, unknown>;
    assert.equal(redacted.authorization, "[redacted]");
    assert.equal(redacted.document_content, "[redacted]");
    assert.equal(String(redacted.message).includes("hunter2"), false);
    assert.equal(String(redacted.message).includes("service_role"), false);
  });

  it("creates run identifiers without secrets", () => {
    const id = createRunId("cron_daily");
    assert.match(id, /^cron_daily_/);
  });
});
