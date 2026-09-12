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
  targetSiteAreaHa: 15,
  maxCandidateAreaHa: 30,
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

  it("does not let a 5000 ha remainder outrank a target-scale site", () => {
    const ranked = rankScreeningCells(
      [
        cell({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Giant remainder",
          usable_area_ha: 5000,
          contiguous_area_ha: 5000,
          compactness: 0.2,
          geometry_quality: "review",
        }),
        cell({
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          name: "Hallsberg South - Site 01",
          usable_area_ha: 18.4,
          contiguous_area_ha: 16.9,
          compactness: 0.82,
          geometry_quality: "pass",
          target_fit_score: 1,
        }),
      ],
      { ...CRITERIA, targetSiteAreaHa: 15, maxCandidateAreaHa: 30 },
    );
    assert.equal(ranked.find((item) => item.id.startsWith("bbbb"))?.rank, 1);
    assert.equal(ranked.find((item) => item.id.startsWith("aaaa"))?.rank, 2);
  });

  it("does not prefer circular compactness over a practical rectangle when both pass", () => {
    const ranked = rankScreeningCells(
      [
        cell({
          id: "cccccccccccccccccccccccccccccccccccc",
          name: "Near-circle buffer",
          usable_area_ha: 14.92,
          contiguous_area_ha: 14.92,
          compactness: 0.997,
          geometry_quality: "pass",
          target_fit_score: 0.99,
        }),
        cell({
          id: "dddddddddddddddddddddddddddddddddddd",
          name: "Irregular open land",
          usable_area_ha: 17.8,
          contiguous_area_ha: 17.8,
          compactness: 0.55,
          geometry_quality: "pass",
          target_fit_score: 1,
        }),
      ],
      { ...CRITERIA, targetSiteAreaHa: 15, maxCandidateAreaHa: 30 },
    );
    assert.equal(ranked.find((item) => item.id.startsWith("dddd"))?.rank, 1);
  });

  it("does not invent infrastructure proximity from covering geography", () => {
    const [result] = rankScreeningCells([cell()], CRITERIA);
    const proximity = result.screening.dimensions.find((item) => item.key === "grid_proximity");
    assert.equal(proximity?.completeness, "insufficient");
    assert.ok(result.screening.uncertainties.some((item) => /Electricity area SE3/i.test(item)));
  });

  it("does not let missing terrain outrank evaluated terrain", () => {
    const ranked = rankScreeningCells(
      [
        cell({
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          name: "No terrain",
          usable_area_ha: 16,
          contiguous_area_ha: 16,
          terrain_queried: false,
          land_cover_queried: true,
          land_cover: { open: 80 },
          target_fit_score: 1,
          geometry_quality: "pass",
        }),
        cell({
          id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
          name: "Has terrain",
          usable_area_ha: 16,
          contiguous_area_ha: 16,
          terrain_queried: true,
          pct_below_slope: 95,
          mean_slope_deg: 2,
          land_cover_queried: true,
          land_cover: { open: 80 },
          target_fit_score: 1,
          geometry_quality: "pass",
        }),
      ],
      CRITERIA,
    );
    assert.equal(ranked.find((item) => item.id.startsWith("ffff"))?.rank, 1);
    assert.equal(ranked.find((item) => item.id.startsWith("eeee"))?.rank, 2);
    const missing = ranked.find((item) => item.id.startsWith("eeee"));
    assert.ok(missing?.intelligence.constraints.some((item) => item.id === "terrain_unavailable"));
    assert.ok(
      (missing?.relativeScore ?? 0) < (ranked.find((item) => item.id.startsWith("ffff"))?.relativeScore ?? 1),
    );
  });

  it("keeps hard exclusions ahead of numeric score", () => {
    const ranked = rankScreeningCells(
      [
        cell({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
          usable_area_ha: 22,
          natura_overlap_pct: 20,
          natura_queried: true,
          target_fit_score: 1,
        }),
        cell({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
          usable_area_ha: 14,
          natura_overlap_pct: 0,
          target_fit_score: 0.7,
        }),
      ],
      CRITERIA,
    );
    assert.equal(ranked.find((item) => item.id.endsWith("01"))?.excluded, true);
    assert.equal(ranked.find((item) => item.id.endsWith("02"))?.rank, 1);
  });
});
