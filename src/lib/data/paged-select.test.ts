import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  POSTGREST_MAX_ROWS,
  fetchAllInChunks,
  fetchAllQueryPages,
  uniqueIds,
} from "./paged-select";

describe("fetchAllQueryPages", () => {
  it("continues past a 1000-row PostgREST page instead of silently truncating", async () => {
    const total = 1250;
    const all = Array.from({ length: total }, (_, index) => index);

    const result = await fetchAllQueryPages<number>(async (from, to) => {
      return { data: all.slice(from, to + 1), error: null };
    }, POSTGREST_MAX_ROWS);

    assert.equal(result.error, null);
    assert.equal(result.rows.length, total);
    assert.equal(result.pageCount, 2);
    assert.equal(result.hitSafetyCap, false);
    assert.equal(result.rows[0], 0);
    assert.equal(result.rows[1249], 1249);
  });

  it("stops when a page is shorter than the page size", async () => {
    const result = await fetchAllQueryPages<string>(async (from, to) => {
      const rows = ["a", "b", "c"].slice(from, to + 1);
      return { data: rows, error: null };
    }, 10);

    assert.deepEqual(result.rows, ["a", "b", "c"]);
    assert.equal(result.pageCount, 1);
  });

  it("returns the error and rows collected so far", async () => {
    const result = await fetchAllQueryPages<number>(async (from) => {
      if (from > 0) {
        return { data: null, error: { message: "boom" } };
      }
      return { data: Array.from({ length: 1000 }, (_, index) => index), error: null };
    }, 1000);

    assert.equal(result.rows.length, 1000);
    assert.equal(result.error, "boom");
  });
});

describe("fetchAllInChunks", () => {
  it("does not drop ids beyond a single .in() chunk", async () => {
    const ids = Array.from({ length: 450 }, (_, index) => `id-${index}`);
    const seen: string[][] = [];

    const result = await fetchAllInChunks(
      ids,
      async (chunk) => {
        seen.push(chunk);
        return { data: chunk.map((id) => ({ id })), error: null };
      },
      200,
    );

    assert.equal(result.error, null);
    assert.equal(result.rows.length, 450);
    assert.equal(seen.length, 3);
    assert.equal(seen[0].length, 200);
    assert.equal(seen[2].length, 50);
  });
});

describe("uniqueIds", () => {
  it("drops nulls and duplicates", () => {
    assert.deepEqual(uniqueIds(["a", null, "b", "a", undefined]), ["a", "b"]);
  });
});
