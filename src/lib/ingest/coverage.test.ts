import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clipWindowToSearch,
  copernicusWindows,
  needsOnDemandFetch,
  nmdWindows,
  roadlinkWindows,
  tilesForBbox,
} from "./coverage-keys";
import {
  assertGapDoesNotClaimAbsence,
  coverageGapMessage,
  onDemandSourcePlan,
  parseSearchAreaCoverage,
} from "./coverage";
import { ROADLINK_SOURCE_SLUG } from "./coverage-keys";

describe("coverage keys", () => {
  it("builds Copernicus 1° tiles overlapping a Malmö bbox", () => {
    const windows = copernicusWindows({ west: 12.9, south: 55.5, east: 12.99, north: 55.7 });
    assert.equal(windows.length, 1);
    assert.equal(windows[0]?.coverageKey, "glo90:N55E012");
  });

  it("splits RoadLink and NMD into reusable stepped tiles", () => {
    const roads = roadlinkWindows({ west: 16.3, south: 59.47, east: 16.9, north: 59.73 });
    const nmd = nmdWindows({ west: 16.3, south: 59.47, east: 16.9, north: 59.73 });
    assert.ok(roads.length >= 1);
    assert.ok(nmd.length >= 1);
    assert.match(roads[0]?.coverageKey ?? "", /^road:0.25:/);
    assert.match(nmd[0]?.coverageKey ?? "", /^nmd2023:0.2:/);
  });

  it("clips a tile to the Search Area so we do not ingest the whole 1° cell", () => {
    const clipped = clipWindowToSearch(
      { west: 12, south: 55, east: 13, north: 56 },
      { west: 12.9, south: 55.5, east: 13.1, north: 55.7 },
    );
    assert.deepEqual(clipped, { west: 12.9, south: 55.5, east: 13, north: 55.7 });
  });

  it("keeps identical overlapping searches on the same tile keys", () => {
    const a = tilesForBbox({ west: 14.91, south: 59.11, east: 15.05, north: 59.22 }, 0.2);
    const b = tilesForBbox({ west: 14.95, south: 59.12, east: 15.02, north: 59.2 }, 0.2);
    assert.equal(a[0]?.west, b[0]?.west);
    assert.equal(a[0]?.south, b[0]?.south);
  });
});

describe("coverage plan", () => {
  it("parses covered/partial/missing/stale and only fetches gaps", () => {
    const coverage = parseSearchAreaCoverage({
      bbox: { west: 14.9, south: 59.1, east: 15.4, north: 59.4 },
      areaKm2: 12,
      nmd: { status: "covered", scope: "bbox", intersectingSummaries: 40 },
      copernicus: { status: "stale", scope: "bbox" },
      roadlink: { status: "missing", scope: "bbox" },
      flood: { status: "missing", scope: "bbox" },
      ground: { status: "missing", scope: "bbox" },
      contamination: { status: "missing", scope: "bbox" },
      protectedAreas: { status: "covered", scope: "national_catalog" },
      natura2000: { status: "covered", scope: "national_catalog" },
      eiNetworkAreas: { status: "covered", scope: "national_catalog" },
      nup: { status: "covered", scope: "national_catalog" },
    });
    assert.ok(coverage);
    const plan = onDemandSourcePlan(coverage);
    assert.equal(plan.find((item) => item.slug === "nv-nmd-2023")?.fetch, false);
    assert.equal(plan.find((item) => item.slug === "copernicus-dem-glo90")?.fetch, true);
    assert.equal(plan.find((item) => item.slug === ROADLINK_SOURCE_SLUG)?.fetch, true);
    assert.equal(plan.find((item) => item.slug === "msb-oversvamningskartering")?.fetch, true);
    assert.equal(plan.find((item) => item.slug === "sgu-jordarter-25k-100k")?.fetch, true);
    assert.equal(plan.find((item) => item.slug === "lst-ebh-potentiellt-fororenade")?.fetch, true);
    assert.equal(needsOnDemandFetch("partial"), true);
    assert.equal(needsOnDemandFetch("covered"), false);
  });

  it("keeps a failed road fetch as UNKNOWN copy, never a clean bill of health", () => {
    const message = coverageGapMessage(ROADLINK_SOURCE_SLUG, "WFS timeout");
    assert.match(message, /Road evidence unavailable/);
    assert.equal(assertGapDoesNotClaimAbsence(message), true);
    assert.equal(assertGapDoesNotClaimAbsence("No road issue"), false);
  });
});
