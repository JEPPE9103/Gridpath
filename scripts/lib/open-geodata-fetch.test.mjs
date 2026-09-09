import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAllowedOpenGeodataUrl, parseGeoJsonFeatureCollection } from "./open-geodata-fetch.mjs";

describe("open geodata fetch allowlist", () => {
  it("allows Naturvårdsverket geodata HTTPS and rejects other hosts", () => {
    assert.equal(
      isAllowedOpenGeodataUrl(
        "https://geodata.naturvardsverket.se/naturvardsregistret/wfs?service=WFS",
      ),
      true,
    );
    assert.equal(
      isAllowedOpenGeodataUrl(
        "https://copernicus-dem-90m.s3.amazonaws.com/Copernicus_DSM_COG_30_N59_00_E015_00_DEM/file.tif",
      ),
      true,
    );
    assert.equal(
      isAllowedOpenGeodataUrl("https://geodata.scb.se/geoserver/stat/ows?service=WFS"),
      true,
    );
    assert.equal(isAllowedOpenGeodataUrl("http://geodata.naturvardsverket.se/wfs"), false);
  });

  it("parses a FeatureCollection and refuses fabricated non-geojson", () => {
    const fc = parseGeoJsonFeatureCollection(
      JSON.stringify({ type: "FeatureCollection", features: [] }),
    );
    assert.equal(fc.features.length, 0);
    assert.throws(() => parseGeoJsonFeatureCollection(JSON.stringify({ type: "Error", message: "no" })));
  });
});
