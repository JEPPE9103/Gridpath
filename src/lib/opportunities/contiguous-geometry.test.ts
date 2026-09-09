import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dropSliverAreas,
  largestContiguousAreaHa,
  meetsMinimumContiguousArea,
  mergeAdjacentQualifyingCells,
} from "./contiguous-geometry";

describe("contiguous candidate-area merge", () => {
  it("merges edge-adjacent qualifying cells and keeps diagonal cells separate", () => {
    const groups = mergeAdjacentQualifyingCells([
      { id: "a", column: 0, row: 0, qualifying: true, usableAreaHa: 10 },
      { id: "b", column: 1, row: 0, qualifying: true, usableAreaHa: 8 },
      { id: "c", column: 1, row: 1, qualifying: true, usableAreaHa: 4 },
      { id: "d", column: 3, row: 3, qualifying: true, usableAreaHa: 12 },
      { id: "e", column: 0, row: 1, qualifying: false, usableAreaHa: 9 },
    ]);
    assert.equal(groups.length, 2);
    const [large, small] = groups;
    assert.deepEqual(new Set(large.cellIds), new Set(["a", "b", "c"]));
    assert.equal(large.totalUsableAreaHa, 22);
    assert.deepEqual(small.cellIds, ["d"]);
  });

  it("does not merge cells that only share a corner", () => {
    const groups = mergeAdjacentQualifyingCells([
      { id: "a", column: 0, row: 0, qualifying: true, usableAreaHa: 5 },
      { id: "b", column: 1, row: 1, qualifying: true, usableAreaHa: 5 },
    ]);
    assert.equal(groups.length, 2);
  });

  it("drops slivers and uses largest contiguous area for the minimum", () => {
    const kept = dropSliverAreas([
      { areaHa: 0.2 },
      { areaHa: 7.2 },
      { areaHa: 3.1 },
    ]);
    assert.equal(kept.length, 2);
    assert.equal(largestContiguousAreaHa(kept.map((item) => item.areaHa)), 7.2);
    assert.equal(meetsMinimumContiguousArea(7.2, 10), false);
    assert.equal(meetsMinimumContiguousArea(10.1, 10), true);
  });
});
