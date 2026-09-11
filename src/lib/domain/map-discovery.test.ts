import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  discoveryGeographyLabel,
  opportunityFootprintFilter,
  opportunityFootprintStyle,
  opportunityFootprintsCollection,
  parseAreaGeometry,
  parseDiscoveryFeatureCollection,
  screeningLayerFilter,
  searchAreaBboxCollection,
} from "@/lib/domain/map-discovery";

describe("map discovery helpers", () => {
  it("parses stored MultiPolygon area_geom and rejects points", () => {
    const polygon = parseAreaGeometry({
      type: "MultiPolygon",
      coordinates: [[[[15, 59], [15.1, 59], [15.1, 59.1], [15, 59.1], [15, 59]]]],
    });
    assert.equal(polygon?.type, "MultiPolygon");
    assert.equal(parseAreaGeometry({ type: "Point", coordinates: [15, 59] }), null);
  });

  it("builds a Search Area bbox as context, not a Candidate Site", () => {
    const collection = searchAreaBboxCollection({
      id: "search-1",
      searchId: "search-1",
      name: "Hallsberg",
      west: 14.9,
      south: 58.9,
      east: 15.3,
      north: 59.2,
    });
    assert.equal(collection.features[0]?.properties.kind, "search-boundary");
    assert.equal(collection.features[0]?.properties.candidateKind, undefined);
  });

  it("keeps Opportunity Zones off unless explicitly enabled", () => {
    assert.deepEqual(screeningLayerFilter(true, false), ["==", ["get", "candidateKind"], "site"]);
    assert.deepEqual(screeningLayerFilter(false, true), ["==", ["get", "candidateKind"], "zone"]);
  });

  it("maps opportunity lifecycle to restrained footprint styles", () => {
    assert.equal(opportunityFootprintStyle("identified"), "saved");
    assert.equal(opportunityFootprintStyle("shortlisted"), "shortlisted");
    assert.equal(opportunityFootprintStyle("rejected"), "rejected");
    assert.equal(opportunityFootprintStyle("promoted"), "promoted");
  });

  it("parses JSON-string area geometry used by PostgREST", () => {
    const parsed = parseAreaGeometry(
      JSON.stringify({
        type: "Polygon",
        coordinates: [[[15, 59], [15.1, 59], [15.1, 59.1], [15, 59.1], [15, 59]]],
      }),
    );
    assert.equal(parsed?.type, "Polygon");
  });

  it("builds opportunity footprints without inventing geometry", () => {
    const collection = opportunityFootprintsCollection([
      { slug: "saved", name: "A", status: "identified", areaGeometry: { type: "Polygon", coordinates: [] } },
      { slug: "point-only", name: "B", status: "identified", areaGeometry: null },
    ]);
    assert.equal(collection.features.length, 1);
    assert.equal(collection.features[0]?.properties.footprintStyle, "saved");
  });

  it("hides rejected opportunity footprints unless that layer is on", () => {
    assert.deepEqual(opportunityFootprintFilter(true, false), ["!=", ["get", "footprintStyle"], "rejected"]);
    assert.deepEqual(opportunityFootprintFilter(false, true), ["==", ["get", "footprintStyle"], "rejected"]);
  });

  it("labels stored search geography without implying a Candidate Site", () => {
    assert.equal(
      discoveryGeographyLabel({ west: 14.9, south: 58.9, east: 15.3, north: 59.2 }),
      "58.90–59.20N · 14.90–15.30E",
    );
    assert.equal(
      parseDiscoveryFeatureCollection({ type: "FeatureCollection", features: [] }).type,
      "FeatureCollection",
    );
  });
});
