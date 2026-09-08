import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OfficialMapFeatureCollection } from "@/lib/domain/official-map";
import {
  getCachedOfficialGeometry,
  getCachedValue,
  officialGeometryCacheKey,
  resetOfficialGeometryCachesForTests,
  setCachedOfficialGeometry,
  setCachedValue,
} from "@/lib/map/official-geometry-cache";

function collection(id: string): OfficialMapFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        id,
        geometry: { type: "Polygon", coordinates: [] },
        properties: {
          id,
          name: id,
          layer: "local_network",
          areaType: null,
          officialOperatorName: null,
          externalId: null,
        },
      },
    ],
    truncated: false,
    featureCount: 1,
    provenance: null,
  };
}

describe("official geometry cache", () => {
  it("keys official geometry by layer and viewport, not tenant project data", () => {
    resetOfficialGeometryCachesForTests();
    const key = officialGeometryCacheKey("local_network", "mid:17.9,59.2,18.2,59.4");
    assert.equal(key.includes("project"), false);
    setCachedOfficialGeometry(key, collection("area-1"));
    assert.equal(getCachedOfficialGeometry(key)?.features[0]?.properties.id, "area-1");
    assert.equal(getCachedOfficialGeometry("planning_area:mid:17.9,59.2,18.2,59.4"), null);
  });

  it("keeps covering and area context in bounded tenant-session caches", () => {
    resetOfficialGeometryCachesForTests();
    setCachedValue("covering", "project-1", { localNetwork: { id: "ln" }, planningArea: null });
    setCachedValue("area", "area-1", { id: "area-1", projectCount: 2 });
    assert.deepEqual(getCachedValue("covering", "project-1"), {
      localNetwork: { id: "ln" },
      planningArea: null,
    });
    assert.equal(getCachedValue<{ id: string }>("area", "area-1")?.id, "area-1");
  });

  it("evicts oldest official geometry when the cache is full", () => {
    resetOfficialGeometryCachesForTests();
    for (let index = 0; index < 13; index += 1) {
      setCachedOfficialGeometry(`local_network:mid:${index}`, collection(`area-${index}`));
    }
    assert.equal(getCachedOfficialGeometry("local_network:mid:0"), null);
    assert.equal(getCachedOfficialGeometry("local_network:mid:12")?.features[0]?.id, "area-12");
  });
});
