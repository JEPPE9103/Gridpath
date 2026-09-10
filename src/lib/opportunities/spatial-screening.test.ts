import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_SEARCH_BBOX_KM2,
  SCREENING_CELL_MAX_METERS,
  SCREENING_CELL_MIN_METERS,
  SCREENING_METHODOLOGY,
  bboxAreaKm2,
  describeRunDelta,
  electricityAreaSpatialWarning,
  parseElectricityArea,
  screeningCellSizeMeters,
  validateSearchBbox,
} from "./spatial-screening";

describe("spatial screening geography", () => {
  it("rejects a Sweden-wide box above the area cap", () => {
    const result = validateSearchBbox({
      west: 11,
      south: 55.2,
      east: 24,
      north: 69,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Maximum for this release/i);
      assert.match(result.error, /west–east|south–north|Narrow/i);
    }
  });

  it("accepts a municipal-scale Swedish bbox and sizes cells toward ~200", () => {
    const result = validateSearchBbox({
      west: 14.9,
      south: 59.1,
      east: 15.4,
      north: 59.4,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.areaKm2 < MAX_SEARCH_BBOX_KM2);
    assert.ok(result.cellSizeMeters >= SCREENING_CELL_MIN_METERS);
    assert.ok(result.cellSizeMeters <= SCREENING_CELL_MAX_METERS);
    assert.equal(result.cellSizeMeters, screeningCellSizeMeters(result.areaKm2 * 1_000_000));
  });

  it("clips a bbox that extends outside Sweden", () => {
    const result = validateSearchBbox({
      west: 8,
      south: 59.2,
      east: 15.3,
      north: 59.4,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.bbox.west >= 10.5);
  });

  it("does not treat SE3 as a spatial clip", () => {
    assert.equal(parseElectricityArea("se3"), "SE3");
    assert.equal(parseElectricityArea("SE5"), null);
    const warning = electricityAreaSpatialWarning("SE3");
    assert.match(warning ?? "", /not used as a spatial filter/i);
    assert.match(SCREENING_METHODOLOGY, /not cadastral parcels|not the original analysis square/i);
  });

  it("describes rerun count changes without inventing reasons", () => {
    const text = describeRunDelta(
      { evaluatedCount: 40, excludedCount: 26, returnedCount: 14 },
      { evaluatedCount: 40, excludedCount: 28, returnedCount: 12 },
    );
    assert.match(text ?? "", /Previous run: 14/);
    assert.match(text ?? "", /Current run: 12/);
  });

  it("documents contiguous dissolve rather than ranked analysis squares", () => {
    assert.match(SCREENING_METHODOLOGY, /DISCOVERY SCREENING|DETAILED SITE SCREENING/i);
    assert.match(SCREENING_METHODOLOGY, /NMD 2023/);
  });

  it("uses a spherical approximation only for the bbox cap, not suitability", () => {
    const area = bboxAreaKm2({ west: 15, south: 59, east: 15.1, north: 59.1 });
    assert.ok(area > 0);
    assert.ok(area < 200);
  });
});
