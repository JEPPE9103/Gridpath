import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { opportunityCopyContainsForbiddenTerm } from "@/lib/opportunities/copy";
import {
  screeningProgressContainsFakePercent,
  screeningProgressForElapsed,
  refineProgressForElapsed,
  SCREENING_PROGRESS_STAGES,
} from "@/lib/opportunities/screening-progress";

describe("screening progress stages", () => {
  it("starts on preparing geography and does not invent a percentage", () => {
    const view = screeningProgressForElapsed(0);
    assert.equal(view.heading, "Analysing search area");
    assert.equal(view.stages[0]?.status, "active");
    assert.equal(view.stages[1]?.status, "pending");
    assert.equal(view.activeId, "geography");
    const blob = [view.heading, view.waitCopy, ...view.stages.map((stage) => `${stage.title} ${stage.detail}`)].join(" ");
    assert.equal(screeningProgressContainsFakePercent(blob), false);
    assert.equal(opportunityCopyContainsForbiddenTerm(blob), null);
    assert.match(blob, /official environmental constraints/i);
    assert.match(blob, /contiguous usable/i);
    assert.doesNotMatch(blob, /available grid capacity|ai is analysing|guaranteed connection|approval probability/i);
  });

  it("keeps generating candidate sites active during the long wait", () => {
    const view = screeningProgressForElapsed(8_000);
    assert.equal(view.activeId, "sites");
    assert.equal(view.stages.find((stage) => stage.id === "geography")?.status, "complete");
    assert.equal(view.stages.find((stage) => stage.id === "sites")?.status, "active");
    assert.equal(view.stages.find((stage) => stage.id === "ranking")?.status, "pending");
  });

  it("moves to ranking only after the site-generation window", () => {
    const view = screeningProgressForElapsed(15_000);
    assert.equal(view.activeId, "ranking");
    assert.ok(view.stages.filter((stage) => stage.status === "complete").length >= 4);
  });

  it("does not check-mark later product stages before their elapsed window", () => {
    const view = screeningProgressForElapsed(200);
    assert.equal(
      view.stages.filter((stage) => stage.status === "complete").map((stage) => stage.id).join(","),
      "",
    );
    assert.equal(SCREENING_PROGRESS_STAGES.length, 5);
  });

  it("uses a shorter refine sequence without fake provider completion", () => {
    const view = refineProgressForElapsed(100);
    assert.equal(view.heading, "Refining selected candidate");
    assert.equal(view.activeId, "land");
    assert.equal(screeningProgressContainsFakePercent(view.waitCopy), false);
    assert.equal(opportunityCopyContainsForbiddenTerm(view.waitCopy), null);
  });
});
