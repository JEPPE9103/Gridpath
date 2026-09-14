import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requireIngestBbox } from "./require-ingest-bbox.mjs";

describe("production ingest bbox", () => {
  it("refuses an implicit Örebro default", () => {
    assert.throws(() => requireIngestBbox([], {}), /does not default to a municipality/);
  });

  it("accepts an explicit bbox including Örebro when requested", () => {
    const bbox = requireIngestBbox(["--bbox=14.9,59.1,15.4,59.4"], {});
    assert.deepEqual(bbox, { west: 14.9, south: 59.1, east: 15.4, north: 59.4 });
  });
});
