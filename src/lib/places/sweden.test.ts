import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeSwedenPlaceResults,
  parseAdministrativePlaces,
  parseNominatimSwedenHits,
  isSwedenPlaceQuery,
} from "./sweden";

describe("Sweden place search", () => {
  it("accepts Swedish municipality envelopes as cartographic, not cadastral", () => {
    const places = parseAdministrativePlaces([
      {
        area_class: "municipality",
        code: "1280",
        name: "Malmö",
        west: 12.9,
        south: 55.5,
        east: 13.15,
        north: 55.7,
      },
    ]);
    assert.equal(places[0]?.kind, "municipality");
    assert.equal(places[0]?.cartographicBoundary, true);
    assert.match(places[0]?.label ?? "", /Malmö/);
  });

  it("clips Nominatim hits to Sweden and ignores foreign results", () => {
    const sweden = parseNominatimSwedenHits([
      {
        display_name: "Göteborg, Västra Götaland, Sweden",
        lat: "57.7089",
        lon: "11.9746",
        boundingbox: ["57.6", "57.8", "11.7", "12.2"],
        class: "place",
        type: "city",
      },
      {
        display_name: "Copenhagen, Denmark",
        lat: "55.6761",
        lon: "12.5683",
        boundingbox: ["55.6", "55.7", "12.5", "12.7"],
        address: { country: "Denmark" },
      },
    ]);
    assert.equal(sweden.some((item) => item.label.startsWith("Göteborg")), true);
    assert.equal(sweden.some((item) => /Copenhagen/i.test(item.label)), false);
  });

  it("merges SCB before Nominatim and ignores short queries", () => {
    assert.equal(isSwedenPlaceQuery("M"), false);
    const merged = mergeSwedenPlaceResults(
      parseAdministrativePlaces([
        { area_class: "municipality", code: "1880", name: "Örebro", west: 15, south: 59.2, east: 15.3, north: 59.3 },
      ]),
      parseNominatimSwedenHits([
        { display_name: "Örebro, Sweden", lat: "59.2753", lon: "15.2134", boundingbox: ["59.2", "59.3", "15.1", "15.3"] },
      ]),
    );
    assert.equal(merged[0]?.kind, "municipality");
    assert.equal(merged.filter((item) => item.label.toLowerCase().includes("örebro")).length, 1);
  });
});
