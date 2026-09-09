import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canCompareOpportunities, compareRecommendation, recommendationRank } from "./compare";

describe("opportunity compare", () => {
  it("requires two to four opportunities", () => {
    assert.equal(canCompareOpportunities(1).ok, false);
    assert.equal(canCompareOpportunities(2).ok, true);
    assert.equal(canCompareOpportunities(4).ok, true);
    assert.equal(canCompareOpportunities(5).ok, false);
  });

  it("ranks recommendations without a success score", () => {
    assert.ok(recommendationRank("prioritise") < recommendationRank("investigate"));
    assert.ok(compareRecommendation("prioritise", "secondary") < 0);
    assert.equal(recommendationRank("insufficient_evidence"), 4);
  });
});
