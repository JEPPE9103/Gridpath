import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describeCompareSet,
  selectDemoOpportunityCandidates,
} from "./demo-seed-selection.mjs";

describe("demo candidate selection", () => {
  const rows = [
    { id: "a", name: "Site A", rank: 1, recommendation: "prioritise", data_confidence: "high", candidate_kind: "site", local_covering_name: "Ellevio", geometry_quality: "good", contiguous_area_ha: 12 },
    { id: "b", name: "Site B", rank: 2, recommendation: "investigate", data_confidence: "medium", candidate_kind: "site", local_covering_name: null, geometry_quality: "review", contiguous_area_ha: 9 },
    { id: "c", name: "Site C", rank: 3, recommendation: "investigate", data_confidence: "medium", candidate_kind: "site", local_covering_name: "Ellevio", geometry_quality: "good", contiguous_area_ha: 8 },
    { id: "d", name: "Site D", rank: 4, recommendation: "secondary", data_confidence: "low", candidate_kind: "site", local_covering_name: null, geometry_quality: "review", contiguous_area_ha: 7 },
    { id: "e", name: "Site E", rank: 5, recommendation: "low_priority", data_confidence: "low", candidate_kind: "site", local_covering_name: null, geometry_quality: "review", contiguous_area_ha: 6 },
    { id: "zone", name: "Zone", rank: 1, candidate_kind: "zone" },
  ];

  it("picks five distinct real sites by rank, not random UUIDs", () => {
    const selected = selectDemoOpportunityCandidates(rows);
    assert.deepEqual(
      selected.map((item) => item.role),
      ["promoted", "shortlisted", "under_review", "saved", "rejected"],
    );
    assert.equal(selected[0].candidate.id, "a");
    assert.equal(new Set(selected.map((item) => item.candidate.id)).size, 5);
    assert.equal(
      selected.some((item) => item.candidate.id === "zone"),
      false,
    );
  });

  it("fails if the run does not produce enough sites", () => {
    assert.throws(() => selectDemoOpportunityCandidates(rows.slice(0, 2)), /need at least 5/);
  });

  it("does not invent compare differences when sites are similar", () => {
    const similar = selectDemoOpportunityCandidates(
      [1, 2, 3, 4, 5].map((rank) => ({
        id: `s${rank}`,
        name: `Site ${rank}`,
        rank,
        recommendation: "investigate",
        data_confidence: "medium",
        candidate_kind: "site",
        local_covering_name: "Ellevio",
        geometry_quality: "good",
        contiguous_area_ha: 10,
      })),
    );
    const compare = describeCompareSet(similar);
    assert.equal(compare.meaningfulDifference, false);
    assert.match(compare.note, /do not falsify/);
  });
});
