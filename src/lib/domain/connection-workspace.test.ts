import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProjectRequirementItem } from "@/lib/data/project-detail-types";
import { applicationReadinessFromRequirements } from "@/lib/domain/application-readiness";
import { deadlineRelativeLabel } from "@/lib/domain/connection-deadlines";
import {
  CONNECTION_READINESS_DISCLAIMER,
  CONNECTION_TRACKING_DISCLAIMER,
  classifyConnectionEvent,
  connectionCaseLifecycle,
  connectionCopyContainsForbiddenTerm,
  connectionNextAction,
  connectionStageJourney,
  canWriteConnectionWorkspace,
  groupConnectionRequirements,
  outstandingRequiredLabels,
  recentProjectDocuments,
} from "@/lib/domain/connection-workspace";

const NOW = new Date(2026, 8, 7);

function req(
  overrides: Partial<ProjectRequirementItem> & Pick<ProjectRequirementItem, "id" | "label">,
): ProjectRequirementItem {
  return {
    status: "Not Started",
    required: true,
    category: "Grid",
    dueDate: null,
    ...overrides,
  };
}

describe("connection workspace domain", () => {
  it("explains readiness as workflow completeness, not probability", () => {
    const readiness = applicationReadinessFromRequirements([
      { status: "Complete", required: true },
      { status: "Complete", required: true },
      { status: "Incomplete", required: true },
      { status: "Not Started", required: false },
    ]);
    assert.equal(readiness.percent, 67);
    assert.equal(readiness.completeCount, 2);
    assert.equal(readiness.requiredCount, 3);
    assert.equal(connectionCopyContainsForbiddenTerm(CONNECTION_READINESS_DISCLAIMER), null);
    assert.match(CONNECTION_READINESS_DISCLAIMER, /workflow completeness/);
    assert.match(CONNECTION_READINESS_DISCLAIMER, /does not estimate connection probability/);
    assert.equal(connectionCopyContainsForbiddenTerm("connection score"), "connection score");
    assert.equal(connectionCopyContainsForbiddenTerm(CONNECTION_TRACKING_DISCLAIMER), null);
    assert.match(CONNECTION_TRACKING_DISCLAIMER, /does not submit applications/);
  });

  it("groups required vs optional and overdue vs upcoming", () => {
    const groups = groupConnectionRequirements(
      [
        req({ id: "1", label: "Protection study", status: "Incomplete", dueDate: "2026-09-01" }),
        req({ id: "2", label: "Single-line diagram", status: "Not Started", dueDate: "2026-09-18" }),
        req({ id: "3", label: "Land-owner consent", status: "In Progress", dueDate: "2026-10-04" }),
        req({ id: "4", label: "Site coordinates", status: "Complete", dueDate: null }),
        req({
          id: "5",
          label: "Optional memo",
          required: false,
          status: "Not Started",
          dueDate: null,
        }),
      ],
      NOW,
    );
    assert.equal(groups.requiredCount, 4);
    assert.equal(groups.completeRequiredCount, 1);
    assert.equal(groups.outstandingRequiredCount, 3);
    assert.equal(groups.overdueRequiredCount, 1);
    assert.deepEqual(
      groups.needsAttention.map((item) => item.label),
      ["Protection study", "Single-line diagram"],
    );
    assert.deepEqual(
      groups.upcoming.map((item) => item.label),
      ["Land-owner consent"],
    );
    assert.equal(groups.optional[0]?.label, "Optional memo");
    assert.deepEqual(outstandingRequiredLabels(groups.needsAttention.concat(groups.upcoming)), [
      "Protection study",
      "Single-line diagram",
      "Land-owner consent",
    ]);
  });

  it("picks deterministic next action without investment language", () => {
    const overdue = connectionNextAction({
      requirements: [req({ id: "1", label: "Protection study", status: "Incomplete", dueDate: "2026-09-01" })],
      now: NOW,
    });
    assert.equal(overdue.kind, "overdue_requirement");
    assert.match(overdue.title, /Protection study/);
    assert.equal(connectionCopyContainsForbiddenTerm(`${overdue.title} ${overdue.detail}`), null);

    const dueSoon = connectionNextAction({
      requirements: [req({ id: "1", label: "Single-line diagram", dueDate: "2026-09-18" })],
      now: NOW,
    });
    assert.equal(dueSoon.kind, "due_soon_requirement");
    assert.equal(dueSoon.title, "Single-line diagram");

    const caseDeadline = connectionNextAction({
      requirements: [req({ id: "1", label: "Site coordinates", status: "Complete" })],
      caseDeadline: "2026-09-10",
      caseStatusValue: "on_track",
      now: NOW,
    });
    assert.equal(caseDeadline.kind, "connection_deadline");

    const incomplete = connectionNextAction({
      requirements: [req({ id: "1", label: "DSO questionnaire" })],
      now: NOW,
    });
    assert.equal(incomplete.kind, "incomplete_requirement");

    const none = connectionNextAction({
      requirements: [req({ id: "1", label: "Site coordinates", status: "Complete" })],
      caseStatusValue: "on_track",
      now: NOW,
    });
    assert.equal(none.kind, "none");
    assert.match(none.title, /No required workflow items need attention/);
    assert.equal(connectionCopyContainsForbiddenTerm("Submit application now"), "submit application now");
  });

  it("describes current, past and next stage from existing pipeline values", () => {
    const journey = connectionStageJourney("Grid Study");
    assert.equal(journey.current, "Grid Study");
    assert.ok(journey.past.includes("Enquiry"));
    assert.equal(journey.next, "Offer");
    assert.equal(connectionStageJourney("Energisation").next, null);
  });

  it("classifies timeline events and case lifecycle without mixing archive", () => {
    assert.equal(classifyConnectionEvent("Connection stage changed"), "stage");
    assert.equal(classifyConnectionEvent("Requirement completed"), "requirement");
    assert.equal(classifyConnectionEvent("Document uploaded"), "document");
    assert.equal(classifyConnectionEvent("Connection process started"), "case");
    assert.equal(connectionCaseLifecycle("on_track"), "active");
    assert.equal(connectionCaseLifecycle("complete"), "complete");
    assert.equal(connectionCaseLifecycle("cancelled"), "cancelled");
    assert.notEqual(connectionCaseLifecycle("complete"), connectionCaseLifecycle("on_track"));
  });

  it("keeps Viewer read-only and uses workflow due labels", () => {
    assert.equal(canWriteConnectionWorkspace("viewer"), false);
    assert.equal(canWriteConnectionWorkspace("member"), true);
    assert.equal(deadlineRelativeLabel("2026-09-01", NOW), "Overdue by 6 days");
    assert.equal(deadlineRelativeLabel("2026-09-10", NOW), "Due in 3 days");
  });

  it("limits recent project documents and keeps empty-state tracking copy honest", () => {
    const docs = recentProjectDocuments(
      Array.from({ length: 8 }, (_, index) => ({
        id: String(index),
        name: `File ${index}.pdf`,
        category: "Other",
        status: "Draft",
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
        owner: null,
        storagePath: null,
        originalFilename: null,
        mimeType: null,
        fileKind: "PDF",
        fileSizeBytes: 1,
        uploadedAt: "2026-09-01T00:00:00Z",
        uploadedByName: null,
        hasStoredFile: false,
      })),
      6,
    );
    assert.equal(docs.length, 6);
    assert.equal(
      connectionCopyContainsForbiddenTerm(
        "Track the project's grid-connection process, requirements, documents and deadlines in one workspace. NOXHEIM records the process your team enters. It does not submit applications to network operators.",
      ),
      null,
    );
  });
});
