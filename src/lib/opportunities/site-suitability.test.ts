import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  landCoverPreferenceScore,
  nmdClassToGroup,
  normalizeLandCoverComposition,
  parseLandCoverProfile,
} from "./land-cover";
import {
  classifySlopeAgainstThreshold,
  hornSlopeDegrees,
  slopeDegreesFromPercent,
  summariseSlopeSample,
} from "./terrain";
import { defaultScreeningProfile, originLabel } from "./screening-profiles";
import { rankScreeningCells, type ScreeningCellRow } from "./run-ranking";
import type { ScreeningCriteria } from "./screening";

describe("NMD land-cover mapping", () => {
  it("maps published NMD codes without inventing unknown classes as preferred", () => {
    assert.equal(nmdClassToGroup(71), "wetland");
    assert.equal(nmdClassToGroup(81), "agriculture");
    assert.equal(nmdClassToGroup(41), "forest");
    assert.equal(nmdClassToGroup(41, "nmd_2023_v0"), "open");
    assert.equal(nmdClassToGroup(84), "developed");
    assert.equal(nmdClassToGroup(999), "unclassified");
  });

  it("scores composition against the organisation profile, not a universal good/bad rule", () => {
    const composition = normalizeLandCoverComposition({ open: 60, forest: 40 });
    const preferred = parseLandCoverProfile({ open: "preferred", forest: "neutral" });
    const inverted = parseLandCoverProfile({ open: "deprioritised", forest: "preferred" });
    assert.ok(landCoverPreferenceScore(composition, preferred) > landCoverPreferenceScore(composition, inverted));
  });
});

describe("terrain slope", () => {
  it("converts percent slope and classifies hard vs preference", () => {
    assert.ok(Math.abs(slopeDegreesFromPercent(8) - 4.57) < 0.05);
    const sample = summariseSlopeSample([1, 2, 3, 4, 9], 5);
    assert.equal(sample.pctBelowThreshold, 80);
    const missing = classifySlopeAgainstThreshold({
      mode: "hard",
      thresholdDeg: 8,
      metrics: {
        queried: false,
        meanSlopeDeg: null,
        medianSlopeDeg: null,
        p90SlopeDeg: null,
        maxSlopeDeg: null,
        pctBelowThreshold: null,
        sourceName: null,
      },
    });
    assert.equal(missing.hardFail, false);
    const fail = classifySlopeAgainstThreshold({
      mode: "hard",
      thresholdDeg: 5,
      metrics: {
        queried: true,
        meanSlopeDeg: 9,
        medianSlopeDeg: 8,
        p90SlopeDeg: 12,
        maxSlopeDeg: 14,
        pctBelowThreshold: 20,
        sourceName: "Copernicus DEM GLO-90",
      },
    });
    assert.equal(fail.hardFail, true);
    assert.match(fail.explanation, /Favorable terrain|exceeds the configured/i);
    assert.ok(hornSlopeDegrees(0.1, 0) > 0);
  });
});

describe("screening profiles", () => {
  it("marks built-in values as NOXHEIM DEFAULT rather than engineering law", () => {
    const profile = defaultScreeningProfile("battery_storage");
    assert.equal(profile.origin, "noxheim_default");
    assert.equal(originLabel(profile.origin), "NOXHEIM DEFAULT");
    assert.equal(profile.criteria.slopeMode, "preference");
    assert.equal(profile.criteria.landCover.wetland, "excluded");
  });
});

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
    name: "Candidate A",
    latitude: 59.27,
    longitude: 15.21,
    gross_area_ha: 40,
    usable_area_ha: 22,
    contiguous_area_ha: 21.8,
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

describe("suitability ranking v2", () => {
  it("ranks the larger contiguous area first for explainable reasons and keeps hard fails last", () => {
    const ranked = rankScreeningCells(
      [
        cell({
          id: "b",
          name: "Candidate B",
          contiguous_area_ha: 13.4,
          usable_area_ha: 13.4,
          p90_slope_deg: 6,
          terrain_queried: true,
          pct_below_slope: 70,
        }),
        cell({
          id: "a",
          name: "Candidate A",
          contiguous_area_ha: 21.8,
          usable_area_ha: 21.8,
          p90_slope_deg: 4.1,
          terrain_queried: true,
          pct_below_slope: 94,
          road_queried: true,
          road_distance_m: 310,
        }),
        cell({
          id: "fail",
          name: "Too small",
          contiguous_area_ha: 3.2,
          usable_area_ha: 3.2,
        }),
      ],
      CRITERIA,
    );
    assert.equal(ranked[0]?.id, "a");
    assert.equal(ranked[0]?.rank, 1);
    assert.match(ranked[0]?.recommendationSummary ?? "", /Priority #1|ranks above/i);
    assert.equal(ranked.find((item) => item.id === "fail")?.excluded, true);
    assert.ok((ranked.find((item) => item.id === "a")?.relativeScore ?? 0) >= (ranked.find((item) => item.id === "b")?.relativeScore ?? 0));
  });

  it("never treats missing terrain or road evidence as a positive score", () => {
    const ranked = rankScreeningCells(
      [
        cell({ id: "with-road", road_queried: true, road_distance_m: 200, contiguous_area_ha: 12 }),
        cell({ id: "no-road", road_queried: false, contiguous_area_ha: 12 }),
      ],
      CRITERIA,
    );
    const withRoad = ranked.find((item) => item.id === "with-road");
    const noRoad = ranked.find((item) => item.id === "no-road");
    assert.ok((withRoad?.relativeScore ?? 0) >= (noRoad?.relativeScore ?? 0));
  });
});
