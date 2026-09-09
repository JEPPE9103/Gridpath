import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rankScreeningCells, type ScreeningCellRow } from "./run-ranking";
import type { ScreeningCriteria } from "./screening";

const CRITERIA: ScreeningCriteria = {
  technology: "battery_storage",
  country: "SE",
  region: "Örebro",
  municipality: null,
  targetMw: 100,
  targetMwh: 200,
  minSiteAreaHa: 8,
  maxDistanceKm: null,
  excludeProtected: true,
  excludeNatura: true,
  maxSlopePercent: null,
  minDistanceResidentialM: null,
  electricityArea: "SE3",
  notes: null,
};

function cell(overrides: Partial<ScreeningCellRow> = {}): ScreeningCellRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Screening area 1",
    latitude: 59.27,
    longitude: 15.21,
    gross_area_ha: 40,
    usable_area_ha: 38,
    protected_overlap_pct: 0,
    natura_overlap_pct: 0,
    protected_names: [],
    natura_names: [],
    local_covering_name: "Örebro Elnät",
    nup_covering_name: "SE3 plan",
    covering_queried: true,
    protected_queried: true,
    natura_queried: true,
    ...overrides,
  };
}

describe("screening cell ranking", () => {
  it("eliminates cells below minimum usable area and overlapping Natura", () => {
    const ranked = rankScreeningCells(
      [
        cell({ id: "a", usable_area_ha: 2, gross_area_ha: 40 }),
        cell({
          id: "b",
          usable_area_ha: 20,
          natura_overlap_pct: 34,
          natura_names: ["Example SCI"],
        }),
        cell({ id: "c", usable_area_ha: 22, local_covering_name: "Örebro Elnät", nup_covering_name: "SE3 plan" }),
      ],
      CRITERIA,
    );
    const byId = new Map(ranked.map((item) => [item.id, item]));
    assert.equal(byId.get("a")?.excluded, true);
    assert.match(byId.get("a")?.exclusionReason ?? "", /contiguous screened area/i);
    assert.equal(byId.get("b")?.excluded, true);
    assert.match(byId.get("b")?.exclusionReason ?? "", /Natura 2000/i);
    assert.equal(byId.get("c")?.excluded, false);
    assert.equal(byId.get("c")?.recommendation, "prioritise");
    assert.equal(byId.get("c")?.rank, 1);
  });

  it("does not invent infrastructure proximity from covering geography", () => {
    const [result] = rankScreeningCells([cell()], CRITERIA);
    const proximity = result.screening.dimensions.find((item) => item.key === "grid_proximity");
    assert.equal(proximity?.completeness, "insufficient");
    assert.ok(result.screening.uncertainties.some((item) => /Electricity area SE3/i.test(item)));
  });
});
