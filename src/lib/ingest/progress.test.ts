import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { opportunityCopyContainsForbiddenTerm } from "@/lib/opportunities/copy";
import { screeningProgressContainsFakePercent } from "@/lib/opportunities/screening-progress";
import {
  DISCOVERY_PROGRESS_STAGES,
  discoveryProgressForElapsed,
  discoveryProgressFromStage,
  parseDiscoveryIngestProgress,
} from "./progress";

describe("discovery ingest progress", () => {
  it("uses named stages without fake percentages", () => {
    const view = discoveryProgressFromStage("land_cover");
    assert.equal(view.activeId, "land_cover");
    assert.equal(view.stages.find((stage) => stage.id === "preparing")?.status, "complete");
    assert.equal(view.stages.find((stage) => stage.id === "roads")?.status, "pending");
    const blob = [view.heading, view.waitCopy, ...view.stages.map((stage) => `${stage.title} ${stage.detail}`)].join(" ");
    assert.equal(screeningProgressContainsFakePercent(blob), false);
    assert.equal(opportunityCopyContainsForbiddenTerm(blob), null);
    assert.equal(DISCOVERY_PROGRESS_STAGES.map((stage) => stage.title).join("|"), [
      "Preparing area",
      "Checking official evidence",
      "Loading land cover",
      "Loading terrain",
      "Loading road geography",
      "Loading flood geography",
      "Loading ground / soil",
      "Running screening",
      "Generating Candidate Sites",
    ].join("|"));
  });

  it("falls back through elapsed stages without claiming provider completion", () => {
    const early = discoveryProgressForElapsed(100);
    assert.equal(early.activeId, "preparing");
    const mid = discoveryProgressForElapsed(7_000);
    assert.equal(mid.activeId, "flood");
    const ground = discoveryProgressForElapsed(9_000);
    assert.equal(ground.activeId, "ground");
    const later = discoveryProgressForElapsed(13_000);
    assert.equal(later.activeId, "screening");
  });

  it("parses server progress payloads", () => {
    const parsed = parseDiscoveryIngestProgress({
      stage: "roads",
      messages: ["Road evidence unavailable — screening continued with reduced evidence."],
      sources: [{ slug: "trafikverket-inspire-roadlink", action: "failed" }],
      updatedAt: "2026-09-14T12:00:00.000Z",
    });
    assert.equal(parsed?.stage, "roads");
    assert.equal(parsed?.sources[0]?.action, "failed");
  });
});
