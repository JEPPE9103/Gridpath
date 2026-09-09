import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canWriteWorkflow } from "@/lib/projects/authorization";
import {
  attentionBandLabel,
  attentionCopyContainsForbiddenTerm,
  attentionLevelLabel,
  deriveDaysInCurrentStage,
  deriveProjectAttention,
  deriveProjectNextAction,
  lastActivityLabel,
} from "./project-attention";
import { buildPortfolioAttention } from "./portfolio-attention";
import type { ProjectAttentionInput } from "./types";

const TODAY = new Date("2026-08-31T12:00:00Z");

function baseInput(overrides: Partial<ProjectAttentionInput> = {}): ProjectAttentionInput {
  return {
    stage: "Grid Study",
    confidence: "High",
    targetCOD: "Q3 2028",
    connectionCaseStatus: "On Track",
    connectionCaseStatusValue: "on_track",
    hasConnectionCase: true,
    requirements: [
      { required: true, status: "Complete", dueDate: null },
      { required: true, status: "Incomplete", dueDate: "2026-09-01" },
    ],
    openAlertSeverities: [],
    nextMilestone: "Grid study kickoff",
    connectionCaseCreatedAt: "2026-07-15T00:00:00Z",
    connectionCaseOwnerAssigned: true,
    unmatchedOfficialGeography: false,
    ...overrides,
  };
}

describe("deriveProjectAttention", () => {
  it("flags at-risk connection case as needs attention", () => {
    const result = deriveProjectAttention(
      baseInput({
        connectionCaseStatus: "At Risk",
        connectionCaseStatusValue: "at_risk",
      }),
      TODAY,
    );
    assert.equal(result.level, "needs_attention");
    assert.equal(result.band, "action");
    assert.ok(result.reasons.some((reason) => reason.key === "case_at_risk"));
  });

  it("scenario 1: overdue required item is action required with correct next action", () => {
    const result = deriveProjectAttention(
      baseInput({
        requirements: [
          {
            id: "req-1",
            label: "Technical documentation",
            required: true,
            status: "Incomplete",
            dueDate: "2026-08-27",
          },
        ],
        projectSlug: "north-bess",
      }),
      TODAY,
    );
    assert.equal(result.band, "action");
    assert.equal(result.level, "needs_attention");
    const signal = result.signals.find((item) => item.type === "overdue_requirements");
    assert.ok(signal);
    assert.match(signal?.detail ?? "", /Technical documentation was due 4 days ago/);
    assert.equal(signal?.dueAt, "2026-08-27");
    assert.equal(result.nextAction.kind, "overdue_requirement");
    assert.equal(result.nextAction.title, "Complete Technical documentation");
    assert.equal(attentionCopyContainsForbiddenTerm(`${signal?.title} ${signal?.detail}`), null);
  });

  it("scenario 2: required item due in 5 days is upcoming, not overdue", () => {
    const result = deriveProjectAttention(
      baseInput({
        requirements: [
          {
            label: "Grid study input",
            required: true,
            status: "Incomplete",
            dueDate: "2026-09-05",
          },
        ],
      }),
      TODAY,
    );
    assert.equal(result.band, "attention");
    assert.equal(result.level, "watch");
    assert.ok(result.signals.some((item) => item.type === "required_due_soon"));
    assert.ok(!result.signals.some((item) => item.type === "overdue_requirements"));
    assert.match(result.signals.find((item) => item.type === "required_due_soon")?.detail ?? "", /due in 5 days/);
    assert.equal(result.nextAction.kind, "due_soon_requirement");
  });

  it("scenario 3: unreviewed official change is review attention until the count clears", () => {
    const waiting = deriveProjectAttention(
      baseInput({
        requirements: [{ required: true, status: "Complete", dueDate: null }],
        unreviewedOfficialChangeCount: 1,
      }),
      TODAY,
    );
    assert.equal(waiting.level, "watch");
    assert.equal(waiting.band, "attention");
    assert.ok(waiting.signals.some((item) => item.type === "unreviewed_official_changes"));
    assert.equal(waiting.nextAction.kind, "official_change");
    assert.match(waiting.nextAction.title, /Review official Ei publication change/);
    assert.match(waiting.signals[0]?.detail ?? "", /not a technical impact/);

    const reviewed = deriveProjectAttention(
      baseInput({
        requirements: [{ required: true, status: "Complete", dueDate: null }],
        unreviewedOfficialChangeCount: 0,
      }),
      TODAY,
    );
    assert.equal(reviewed.band, "clear");
    assert.ok(!reviewed.signals.some((item) => item.type === "unreviewed_official_changes"));
  });

  it("scenario 4: connection deadline overdue is action required", () => {
    const result = deriveProjectAttention(
      baseInput({
        requirements: [{ required: true, status: "Complete", dueDate: null }],
        connectionDeadline: "2026-08-28",
      }),
      TODAY,
    );
    assert.equal(result.band, "action");
    const signal = result.signals.find((item) => item.type === "connection_deadline_overdue");
    assert.ok(signal);
    assert.match(signal?.detail ?? "", /passed 3 days ago/);
    assert.equal(result.nextAction.kind, "connection_deadline_overdue");
  });

  it("scenario 5: no next milestone is review-level only", () => {
    const result = deriveProjectAttention(
      baseInput({
        requirements: [{ required: true, status: "Complete", dueDate: null }],
        nextMilestone: "",
      }),
      TODAY,
    );
    assert.equal(result.band, "review");
    assert.equal(result.level, "watch");
    assert.ok(result.signals.some((item) => item.type === "no_next_milestone"));
    assert.ok(!result.signals.some((item) => item.severity === "action"));
    assert.equal(result.nextAction.kind, "missing_milestone");
  });

  it("scenario 6: project with no issues is clear", () => {
    const result = deriveProjectAttention(
      {
        stage: "Application",
        confidence: "High",
        targetCOD: "Q1 2028",
        connectionCaseStatus: "On Track",
        connectionCaseStatusValue: "on_track",
        hasConnectionCase: true,
        requirements: [{ required: true, status: "Complete", dueDate: null }],
        openAlertSeverities: [],
        nextMilestone: "Offer review",
        connectionCaseOwnerAssigned: true,
        unmatchedOfficialGeography: false,
      },
      TODAY,
    );
    assert.equal(result.level, "on_track");
    assert.equal(result.band, "clear");
    assert.equal(result.nextAction.kind, "none");
    assert.equal(result.signals.length, 0);
  });

  it("scenario 7: multiple signals keep deterministic priority and next action", () => {
    const result = deriveProjectAttention(
      baseInput({
        requirements: [
          { label: "Technical submission", required: true, status: "Incomplete", dueDate: "2026-08-20" },
          { label: "Grid study input", required: true, status: "Incomplete", dueDate: "2026-09-03" },
        ],
        connectionDeadline: "2026-08-25",
        unreviewedOfficialChangeCount: 1,
        nextMilestone: "",
      }),
      TODAY,
    );
    assert.equal(result.band, "action");
    assert.equal(result.nextAction.kind, "overdue_requirement");
    assert.equal(result.nextAction.title, "Complete Technical submission");
    const types = result.signals.map((item) => item.type);
    assert.ok(types.includes("overdue_requirements"));
    assert.ok(types.includes("connection_deadline_overdue"));
    assert.ok(types.includes("unreviewed_official_changes"));
  });

  it("flags incomplete workflow as watch", () => {
    const result = deriveProjectAttention(
      baseInput({
        connectionCaseStatus: "On Track",
        connectionCaseStatusValue: "on_track",
        requirements: [
          { required: true, status: "Incomplete", dueDate: "2026-12-01" },
          { required: true, status: "Not Started", dueDate: null },
        ],
      }),
      TODAY,
    );
    assert.equal(result.level, "watch");
    assert.equal(result.band, "review");
    assert.ok(result.reasons.some((reason) => reason.key === "incomplete_requirements"));
  });

  it("flags missing connection case on advanced stage as watch", () => {
    const result = deriveProjectAttention(
      baseInput({
        stage: "Application",
        hasConnectionCase: false,
        connectionCaseStatus: null,
        connectionCaseStatusValue: null,
        requirements: [],
        targetCOD: "Q4 2028",
        nextMilestone: undefined,
        connectionCaseCreatedAt: undefined,
        connectionCaseOwnerAssigned: undefined,
      }),
      TODAY,
    );
    assert.equal(result.level, "watch");
    assert.ok(result.reasons.some((reason) => reason.key === "missing_connection_case"));
  });

  it("returns insufficient data when workflow signals are missing", () => {
    const result = deriveProjectAttention(
      {
        stage: "Prospect",
        confidence: "Unknown",
        targetCOD: "",
        connectionCaseStatus: null,
        connectionCaseStatusValue: null,
        hasConnectionCase: false,
        requirements: [],
        openAlertSeverities: [],
      },
      TODAY,
    );
    assert.equal(result.level, "insufficient_data");
    assert.equal(result.band, "clear");
  });

  it("returns on track for clean project", () => {
    const result = deriveProjectAttention(
      {
        stage: "Application",
        confidence: "High",
        targetCOD: "Q1 2028",
        connectionCaseStatus: "On Track",
        connectionCaseStatusValue: "on_track",
        hasConnectionCase: true,
        requirements: [{ required: true, status: "Complete", dueDate: null }],
        openAlertSeverities: [],
        nextMilestone: "Offer",
        connectionCaseOwnerAssigned: true,
        unmatchedOfficialGeography: false,
      },
      TODAY,
    );
    assert.equal(result.level, "on_track");
  });

  it("flags unreviewed official changes as watch, not a risk score", () => {
    const result = deriveProjectAttention(
      baseInput({
        unreviewedOfficialChangeCount: 1,
        requirements: [{ required: true, status: "Complete", dueDate: null }],
      }),
      TODAY,
    );
    assert.equal(result.level, "watch");
    assert.ok(result.reasons.some((reason) => reason.key === "unreviewed_official_changes"));
    assert.equal(attentionCopyContainsForbiddenTerm(result.signals.map((item) => `${item.title} ${item.detail ?? ""}`).join("\n")), null);
  });

  it("scenario 10: empty tenant inputs produce no fake attention", () => {
    const result = buildPortfolioAttention([]);
    assert.equal(result.actionRequiredCount, 0);
    assert.equal(result.upcomingCount, 0);
    assert.equal(result.prioritized.length, 0);
    assert.deepEqual(result.needsAttention, []);
  });

  it("scenario 11: stage duration uses stage-change events then case created_at", () => {
    const fromEvent = deriveDaysInCurrentStage(
      {
        hasConnectionCase: true,
        connectionCaseCreatedAt: "2026-01-01T00:00:00Z",
        events: [
          { title: "Requirement completed", occurredAt: "2026-08-30T00:00:00Z" },
          { title: "Connection stage changed", occurredAt: "2026-07-15T00:00:00Z" },
        ],
      },
      TODAY,
    );
    assert.equal(fromEvent.source, "stage_event");
    assert.equal(fromEvent.days, 47);

    const fromCase = deriveDaysInCurrentStage(
      {
        hasConnectionCase: true,
        connectionCaseCreatedAt: "2026-08-01T00:00:00Z",
        events: [{ title: "Requirement completed", occurredAt: "2026-08-20T00:00:00Z" }],
      },
      TODAY,
    );
    assert.equal(fromCase.source, "case_created");
    assert.equal(fromCase.days, 30);

    const unavailable = deriveDaysInCurrentStage({ hasConnectionCase: false }, TODAY);
    assert.equal(unavailable.source, "unavailable");
    assert.equal(unavailable.days, null);
  });

  it("does not invent stalled language for inactivity", () => {
    const result = deriveProjectAttention(
      baseInput({
        requirements: [{ required: true, status: "Complete", dueDate: null }],
        lastActivityAt: "2026-07-01T00:00:00Z",
      }),
      TODAY,
    );
    const inactive = result.signals.find((item) => item.type === "inactive_30d");
    assert.ok(inactive);
    assert.equal(inactive?.severity, "review");
    assert.equal(inactive?.title, "No recorded project activity in 30 days");
    assert.equal(attentionCopyContainsForbiddenTerm(inactive?.title ?? ""), null);
    assert.match(lastActivityLabel("2026-08-28T00:00:00Z", TODAY), /Last activity 3 days ago/);
  });

  it("scenario 8: viewers remain read-only while attention stays visible from data", () => {
    assert.equal(canWriteWorkflow("viewer"), false);
    assert.equal(canWriteWorkflow("member"), true);
    const result = deriveProjectAttention(
      baseInput({
        requirements: [{ required: true, status: "Incomplete", dueDate: "2026-08-01" }],
      }),
      TODAY,
    );
    assert.equal(result.band, "action");
  });
});

describe("deriveProjectNextAction", () => {
  it("follows the documented priority order", () => {
    const overdue = deriveProjectNextAction(
      baseInput({
        requirements: [{ label: "A", required: true, status: "Incomplete", dueDate: "2026-08-01" }],
        connectionDeadline: "2026-08-01",
        unreviewedOfficialChangeCount: 2,
      }),
      TODAY,
    );
    assert.equal(overdue.kind, "overdue_requirement");
  });
});

describe("attention labels", () => {
  it("does not use Needs attention for workflow bands or levels", () => {
    assert.equal(attentionBandLabel("action"), "Action required");
    assert.equal(attentionBandLabel("attention"), "Watch");
    assert.equal(attentionLevelLabel("needs_attention"), "Action required");
    assert.equal(attentionLevelLabel("watch"), "Watch");
  });
});
