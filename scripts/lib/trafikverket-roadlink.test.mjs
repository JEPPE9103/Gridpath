import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRoadLinkWfsUrl, TRAFIKVERKET_ROADLINK_TYPE } from "./trafikverket-roadlink.mjs";

describe("Trafikverket RoadLink WFS", () => {
  it("uses the documented typeNames=RoadLink form, not a prefixed type", () => {
    const url = buildRoadLinkWfsUrl({ west: 14.9, south: 59.1, east: 15.4, north: 59.4 }, 0, "latlon");
    assert.match(url, /typeNames=RoadLink/);
    assert.match(url, /count=5000/);
    assert.doesNotMatch(url, /tn-ro%3ARoadLink|tn-ro:RoadLink/);
    assert.equal(TRAFIKVERKET_ROADLINK_TYPE, "RoadLink");
  });

  it("sends EPSG:4326 bbox in lat,lon axis order by default", () => {
    const url = buildRoadLinkWfsUrl({ west: 14.9, south: 59.1, east: 15.4, north: 59.4 }, 0);
    assert.match(url, /bbox=59\.1%2C14\.9%2C59\.4%2C15\.4%2CEPSG%3A4326/);
  });

  it("does not advertise startIndex pagination as the supported delivery path", () => {
    const url = buildRoadLinkWfsUrl({ west: 14.9, south: 59.1, east: 15.4, north: 59.4 }, 0, "latlon");
    assert.doesNotMatch(url, /startIndex=/);
  });
});
