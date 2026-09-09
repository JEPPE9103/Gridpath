import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NUP_FORECAST_TRANSFER_CAPACITY_NEED } from "@/lib/domain/grid-intelligence";
import { reviewStatusLabel } from "@/lib/domain/grid-change-presentation";
import {
  GEOGRAPHIC_OVERLAP_EXPLANATION,
  NUP_FORECAST_NEED_CHANGE_DISCLAIMER,
  OFFICIAL_CHANGE_UNKNOWN_SUMMARY,
  canReviewOfficialChangeImpacts,
  countOfficialChangeImpacts,
  isOfficialSourceUpdateDelayed,
  officialChangeCopyContainsForbiddenTerm,
  paginateItems,
  summarizeOfficialChange,
} from "@/lib/domain/official-change-summary";

describe("official change summaries", () => {
  it("summarizes NUP forecast need without capacity language", () => {
    const text = summarizeOfficialChange({
      kind: "changed",
      semantic: NUP_FORECAST_TRANSFER_CAPACITY_NEED,
      before: { valueNumeric: 120, unit: "MW", year: 2030 },
      after: { valueNumeric: 145, unit: "MW", year: 2030 },
    });
    assert.equal(
      text,
      "Forecast transfer-capacity need for 2030 changed from 120 MW to 145 MW.",
    );
    assert.equal(officialChangeCopyContainsForbiddenTerm(text), null);
    assert.equal(officialChangeCopyContainsForbiddenTerm(NUP_FORECAST_NEED_CHANGE_DISCLAIMER), null);
    assert.match(NUP_FORECAST_NEED_CHANGE_DISCLAIMER, /does not represent available connection capacity/);
  });

  it("summarizes add and remove without inventing meaning", () => {
    assert.equal(
      summarizeOfficialChange({ kind: "added", semantic: "other" }),
      "Official planning-area record was added.",
    );
    assert.equal(
      summarizeOfficialChange({ kind: "removed", semantic: "other" }),
      "Official record was removed from the latest publication.",
    );
  });

  it("summarizes operator-name and unknown fields without inventing capacity meaning", () => {
    assert.equal(
      summarizeOfficialChange({
        kind: "changed",
        semantic: "official_operator_name",
        before: { valueText: "Old Operator" },
        after: { valueText: "New Operator" },
      }),
      "Operator name changed from Old Operator to New Operator.",
    );
    assert.equal(
      summarizeOfficialChange({ kind: "changed", semantic: "mystery_field" }),
      OFFICIAL_CHANGE_UNKNOWN_SUMMARY,
    );
  });

  it("rejects capacity/headroom interpretations", () => {
    assert.equal(
      officialChangeCopyContainsForbiddenTerm("Capacity increased"),
      "capacity increased",
    );
    assert.equal(
      officialChangeCopyContainsForbiddenTerm("your project is impacted technically"),
      "your project is impacted technically",
    );
    assert.equal(officialChangeCopyContainsForbiddenTerm(GEOGRAPHIC_OVERLAP_EXPLANATION), null);
    assert.match(GEOGRAPHIC_OVERLAP_EXPLANATION, /not a connection point/);
  });
});

describe("official change inbox helpers", () => {
  it("counts review state without a grid score and keeps org rows isolated", () => {
    const counts = countOfficialChangeImpacts([
      { reviewStatus: "unreviewed", projectId: "p1" },
      { reviewStatus: "unreviewed", projectId: "p1" },
      { reviewStatus: "confirmed", projectId: "p2" },
      { reviewStatus: "dismissed", projectId: "p3" },
    ]);
    assert.equal(counts.unreviewed, 2);
    assert.equal(counts.confirmed, 1);
    assert.equal(counts.dismissed, 1);
    assert.equal(counts.unreviewedProjectCount, 1);
  });

  it("paginates inbox rows", () => {
    const result = paginateItems(["a", "b", "c", "d", "e"], 2, 2);
    assert.deepEqual(result.items, ["c", "d"]);
    assert.equal(result.pageCount, 3);
    assert.equal(result.total, 5);
    assert.equal(paginateItems(["a"], 9, 2).page, 1);
  });

  it("keeps review write access off for Viewer and uses Needs review, not grid risk", () => {
    assert.equal(canReviewOfficialChangeImpacts("viewer"), false);
    assert.equal(canReviewOfficialChangeImpacts("member"), true);
    assert.equal(reviewStatusLabel("unreviewed"), "Needs review");
    assert.equal(reviewStatusLabel("confirmed"), "Confirmed relevant");
    assert.equal(isOfficialSourceUpdateDelayed("healthy"), false);
    assert.equal(isOfficialSourceUpdateDelayed("failed"), true);
    assert.equal(isOfficialSourceUpdateDelayed("stale"), true);
  });

  it("scenario 12: delayed source stays delayed even with zero unreviewed changes", () => {
    assert.equal(countOfficialChangeImpacts([]).unreviewed, 0);
    assert.equal(isOfficialSourceUpdateDelayed("stale"), true);
    assert.equal(
      officialChangeCopyContainsForbiddenTerm("No unreviewed official changes are currently listed. Source update currently delayed."),
      null,
    );
  });
});
