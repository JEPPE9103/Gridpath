import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveProjectAttention } from "./project-attention";
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
    assert.ok(result.reasons.some((reason) => reason.key === "case_at_risk"));
  });

  it("flags overdue required items as needs attention", () => {
    const result = deriveProjectAttention(
      baseInput({
        requirements: [
          { required: true, status: "Incomplete", dueDate: "2026-08-01" },
        ],
      }),
      TODAY,
    );
    assert.equal(result.level, "needs_attention");
    assert.ok(result.reasons.some((reason) => reason.key === "overdue_requirements"));
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
      },
      TODAY,
    );
    assert.equal(result.level, "on_track");
  });
});
