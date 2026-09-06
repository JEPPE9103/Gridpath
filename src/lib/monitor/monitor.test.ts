import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSourceRefreshDue, nextEligibleRefreshAt } from "@/lib/monitor/cadence";
import { authorizeCronRequest } from "@/lib/monitor/cron-auth";
import { classifyIngestError, sanitizeIngestError, shouldRetryIngestError } from "@/lib/monitor/errors";
import { isAllowedOfficialFetchUrl } from "@/lib/monitor/official-sources";
import { deriveSourceHealth, sourceChangeLabel } from "@/lib/monitor/source-health";
import {
  changeImpactAlertNaturalKey,
  connectionAlertNaturalKey,
  isActionableAlertStatus,
  requirementAlertNaturalKey,
} from "@/lib/alerts/natural-key";
import {
  connectionDeadlineKind,
  requirementDeadlineKind,
  shouldResolveDeadlineAlert,
} from "@/lib/alerts/workflow-policy";
import {
  emailWouldClaimSent,
  impactEmailSubject,
  impactEmailText,
  isDigestEmpty,
  weeklyDigestText,
} from "@/lib/notifications/copy";

describe("source refresh cadence", () => {
  const now = new Date("2026-09-05T12:00:00Z");

  it("treats a scheduled source as not due when last success is inside the interval", () => {
    const lastSuccessAt = new Date("2026-09-04T12:00:00Z");
    assert.equal(
      isSourceRefreshDue({
        trigger: "scheduled",
        now,
        lastSuccessAt,
        lastAttemptStatus: "success",
        refreshIntervalHours: 168,
      }),
      "not_due",
    );
  });

  it("treats a scheduled source as due when the interval has elapsed", () => {
    assert.equal(
      isSourceRefreshDue({
        trigger: "scheduled",
        now,
        lastSuccessAt: new Date("2026-08-20T12:00:00Z"),
        lastAttemptStatus: "success",
        refreshIntervalHours: 168,
      }),
      "due",
    );
  });

  it("retries a failed source on the next scheduled tick", () => {
    assert.equal(
      isSourceRefreshDue({
        trigger: "scheduled",
        now,
        lastSuccessAt: new Date("2026-09-04T12:00:00Z"),
        lastAttemptStatus: "failed",
        refreshIntervalHours: 168,
      }),
      "retry_failed",
    );
  });

  it("lets a manual trigger run even when not due", () => {
    assert.equal(
      isSourceRefreshDue({
        trigger: "manual",
        now,
        lastSuccessAt: new Date("2026-09-04T12:00:00Z"),
        lastAttemptStatus: "success",
        refreshIntervalHours: 168,
      }),
      "due",
    );
    assert.equal(
      nextEligibleRefreshAt({
        lastSuccessAt: new Date("2026-09-04T12:00:00Z"),
        refreshIntervalHours: 24,
      }).toISOString(),
      "2026-09-05T12:00:00.000Z",
    );
  });

  it("does not treat a probe-only success as a full-ingest cadence anchor", () => {
    assert.equal(
      isSourceRefreshDue({
        trigger: "scheduled",
        now,
        lastSuccessAt: new Date("2026-09-04T12:00:00Z"),
        lastAttemptStatus: "success",
        refreshIntervalHours: 168,
        lastSuccessWasProbeOnly: true,
      }),
      "due",
    );
  });
});

describe("source health", () => {
  const now = new Date("2026-09-05T12:00:00Z");

  it("treats unchanged successful refresh as healthy, not an error", () => {
    assert.equal(
      deriveSourceHealth({
        lastAttemptStatus: "success",
        lastAttemptSourceChanged: false,
        lastSuccessAt: now,
        lastSnapshotAt: now,
        refreshIntervalHours: 168,
        now,
      }),
      "healthy",
    );
    assert.match(
      sourceChangeLabel(false, "success"),
      /published content unchanged/i,
    );
  });

  it("returns to healthy after a later successful run", () => {
    assert.equal(
      deriveSourceHealth({
        lastAttemptStatus: "success",
        lastAttemptSourceChanged: false,
        lastSuccessAt: now,
        lastSnapshotAt: now,
        refreshIntervalHours: 168,
        now,
      }),
      "healthy",
    );
  });

  it("marks a source failed when the latest attempt failed", () => {
    assert.equal(
      deriveSourceHealth({
        lastAttemptStatus: "failed",
        lastAttemptSourceChanged: null,
        lastSuccessAt: now,
        lastSnapshotAt: now,
        refreshIntervalHours: 168,
        now,
      }),
      "failed",
    );
  });

  it("marks never ingested when there is no snapshot or success", () => {
    assert.equal(
      deriveSourceHealth({
        lastAttemptStatus: null,
        lastAttemptSourceChanged: null,
        lastSuccessAt: null,
        lastSnapshotAt: null,
        refreshIntervalHours: 168,
        now,
      }),
      "never_ingested",
    );
  });

  it("uses twice the configured cadence as the stale threshold", () => {
    assert.equal(
      deriveSourceHealth({
        lastAttemptStatus: "success",
        lastAttemptSourceChanged: false,
        lastSuccessAt: new Date("2026-08-01T12:00:00Z"),
        lastSnapshotAt: new Date("2026-08-01T12:00:00Z"),
        refreshIntervalHours: 168,
        now,
      }),
      "stale",
    );
  });
});

describe("cron authorization", () => {
  it("rejects missing or wrong secrets", () => {
    assert.equal(
      authorizeCronRequest(new Request("https://www.noxheim.com/api/internal/monitor/daily"), "secret"),
      false,
    );
    assert.equal(
      authorizeCronRequest(
        new Request("https://www.noxheim.com/api/internal/monitor/daily", {
          headers: { authorization: "Bearer other" },
        }),
        "secret",
      ),
      false,
    );
  });

  it("accepts a bearer or x-cron-secret match and never reads query strings", () => {
    assert.equal(
      authorizeCronRequest(
        new Request("https://www.noxheim.com/api/internal/monitor/daily?secret=secret", {
          headers: { authorization: "Bearer secret" },
        }),
        "secret",
      ),
      true,
    );
    assert.equal(
      authorizeCronRequest(
        new Request("https://www.noxheim.com/api/internal/monitor/daily?secret=secret", {
          headers: { "x-cron-secret": "secret" },
        }),
        "secret",
      ),
      true,
    );
    assert.equal(
      authorizeCronRequest(
        new Request("https://www.noxheim.com/api/internal/monitor/daily?secret=secret"),
        "secret",
      ),
      false,
    );
  });

  it("rejects when CRON_SECRET is unset", () => {
    assert.equal(
      authorizeCronRequest(
        new Request("https://www.noxheim.com/api/internal/monitor/daily", {
          headers: { authorization: "Bearer secret" },
        }),
        "",
      ),
      false,
    );
  });
});

describe("official fetch allowlist", () => {
  it("allows only https ei.se hosts", () => {
    assert.equal(isAllowedOfficialFetchUrl("https://ei.se/path"), true);
    assert.equal(isAllowedOfficialFetchUrl("https://www.ei.se/file.xlsx"), true);
    assert.equal(isAllowedOfficialFetchUrl("https://evil.example/ei.se"), false);
    assert.equal(isAllowedOfficialFetchUrl("http://ei.se/path"), false);
  });
});

describe("ingest error handling", () => {
  it("retries transient fetch and database errors, not parse errors", () => {
    assert.equal(shouldRetryIngestError(classifyIngestError(new Error("Fetch failed (503)"))), true);
    assert.equal(shouldRetryIngestError(classifyIngestError(new Error("connection terminated"))), true);
    assert.equal(
      shouldRetryIngestError(classifyIngestError(new Error("Could not discover the official Ei NUP Excel"))),
      false,
    );
  });

  it("redacts credentials from stored error summaries", () => {
    const sanitized = sanitizeIngestError(
      "postgres://user:super-secret@db.example/postgres service_role eyJhbGciOi-not-a-real-token-value-at-all",
    );
    assert.equal(sanitized.includes("super-secret"), false);
    assert.equal(sanitized.includes("service_role"), false);
  });
});

describe("change and alert dedup keys", () => {
  it("uses a stable natural key per change impact", () => {
    const key = changeImpactAlertNaturalKey("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.equal(key, "change_impact:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.equal(key, changeImpactAlertNaturalKey("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
  });

  it("does not treat dismissed or resolved alerts as actionable bell items", () => {
    assert.equal(isActionableAlertStatus("open"), true);
    assert.equal(isActionableAlertStatus("dismissed"), false);
    assert.equal(isActionableAlertStatus("resolved"), false);
  });
});

describe("workflow deadline alerts", () => {
  const now = new Date("2026-09-05T12:00:00Z");

  it("creates an approaching required-item condition within 14 days", () => {
    assert.equal(
      requirementDeadlineKind({
        required: true,
        status: "in_progress",
        dueDate: "2026-09-12",
        now,
      }),
      "approaching",
    );
    assert.equal(
      requirementAlertNaturalKey("req-1", "approaching"),
      "requirement:req-1:approaching",
    );
  });

  it("creates an overdue required-item condition once past due", () => {
    assert.equal(
      requirementDeadlineKind({
        required: true,
        status: "in_progress",
        dueDate: "2026-08-01",
        now,
      }),
      "overdue",
    );
  });

  it("does not alert completed or optional requirements", () => {
    assert.equal(
      requirementDeadlineKind({
        required: true,
        status: "complete",
        dueDate: "2026-08-01",
        now,
      }),
      null,
    );
    assert.equal(
      requirementDeadlineKind({
        required: false,
        status: "in_progress",
        dueDate: "2026-08-01",
        now,
      }),
      null,
    );
  });

  it("resolves the open approaching alert when the item is completed", () => {
    assert.equal(
      shouldResolveDeadlineAlert({
        kind: "approaching",
        current: requirementDeadlineKind({
          required: true,
          status: "complete",
          dueDate: "2026-09-12",
          now,
        }),
      }),
      true,
    );
  });

  it("creates connection deadline alerts using the same 14-day window", () => {
    assert.equal(
      connectionDeadlineKind({ status: "on_track", deadline: "2026-09-10", now }),
      "approaching",
    );
    assert.equal(
      connectionDeadlineKind({ status: "on_track", deadline: "2026-08-01", now }),
      "overdue",
    );
    assert.equal(
      connectionDeadlineKind({ status: "complete", deadline: "2026-08-01", now }),
      null,
    );
    assert.equal(
      connectionAlertNaturalKey("case-1", "overdue"),
      "connection:case-1:overdue",
    );
  });
});

describe("notification copy and delivery semantics", () => {
  it("does not claim a connection is at risk", () => {
    const text = impactEmailText({
      projectName: "North BESS",
      sourceName: "Energimarknadsinspektionen — Nätutvecklingsplaner",
      detectedAtLabel: "2026-09-05",
      appUrl: "https://www.noxheim.com",
    });
    assert.match(text, /may be relevant to North BESS/);
    assert.equal(/your connection is at risk|capacity loss/i.test(text), false);
    assert.match(text, /does not mean the project will be negatively affected/);
    assert.match(impactEmailSubject("North BESS"), /may be relevant to North BESS/);
  });

  it("does not treat attempted or failed provider results as sent", () => {
    assert.equal(emailWouldClaimSent("accepted"), true);
    assert.equal(emailWouldClaimSent("attempted"), false);
    assert.equal(emailWouldClaimSent("failed"), false);
  });

  it("skips an empty weekly digest and keeps the payload org-scoped", () => {
    assert.equal(
      isDigestEmpty({
        organizationName: "Org A",
        periodKey: "digest:2026-W36",
        activeProjectCount: 12,
        attentionProjectCount: 0,
        newImpactCount: 0,
        overdueRequiredCount: 0,
        approachingDeadlineCount: 0,
        addedProjectCount: 0,
        archivedProjectCount: 0,
      }),
      true,
    );
    const digest = weeklyDigestText(
      {
        organizationName: "Org A",
        periodKey: "digest:2026-W36",
        activeProjectCount: 4,
        attentionProjectCount: 1,
        newImpactCount: 2,
        overdueRequiredCount: 1,
        approachingDeadlineCount: 0,
        addedProjectCount: 0,
        archivedProjectCount: 0,
      },
      "https://www.noxheim.com",
    );
    assert.match(digest, /Org A/);
    assert.equal(digest.includes("Org B"), false);
  });
});

describe("concurrent run protection contract", () => {
  it("records already_running as a non-retryable skip class", () => {
    assert.equal(classifyIngestError(new Error("already_running")), "already_running");
    assert.equal(shouldRetryIngestError("already_running"), false);
  });
});
