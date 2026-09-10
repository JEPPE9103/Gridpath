import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aspectRatioFromEnvelope,
  compactnessScore,
  geometryQualityFromMetrics,
  resolveSiteAreaProfile,
  siteDisplayName,
  siteMinSeparationM,
  targetFitAssessment,
} from "./site-generation";

describe("site-generation v2.1", () => {
  it("uses labelled NOXHEIM defaults and never lets max fall below target", () => {
    const profile = resolveSiteAreaProfile({ minSiteAreaHa: 8 });
    assert.equal(profile.minHa, 8);
    assert.equal(profile.targetHa, 15);
    assert.equal(profile.maxHa, 30);
    assert.equal(profile.maxReturned, 25);
    const tight = resolveSiteAreaProfile({ minSiteAreaHa: 20, targetSiteAreaHa: 10, maxCandidateAreaHa: 12 });
    assert.equal(tight.minHa, 20);
    assert.equal(tight.targetHa, 20);
    assert.equal(tight.maxHa, 20);
  });

  it("does not reward a 5000 ha blob over a site that meets target", () => {
    const profile = resolveSiteAreaProfile({
      minSiteAreaHa: 8,
      targetSiteAreaHa: 15,
      maxCandidateAreaHa: 30,
    });
    const fitA = targetFitAssessment(18.4, profile);
    const fitB = targetFitAssessment(5000, profile);
    assert.ok(fitA.score > fitB.score);
    assert.match(fitA.label, /target-area fit/i);
    assert.match(fitB.label, /no additional ranking benefit/i);
  });

  it("treats a practical rectangle as pass and does not require circular compactness", () => {
    const square = compactnessScore(10_000, 400);
    const rectangle = compactnessScore(15_000, 500);
    assert.ok(square > 0.7);
    assert.ok(rectangle > 0.5);
    assert.equal(
      geometryQualityFromMetrics({
        compactness: rectangle,
        coreAreaRatio: 0.9,
        aspectRatio: aspectRatioFromEnvelope(150, 100),
        partCount: 1,
        usableRatio: 0.85,
      }).label,
      "pass",
    );
    assert.match(
      geometryQualityFromMetrics({
        compactness: rectangle,
        coreAreaRatio: 0.9,
        aspectRatio: 1.5,
        partCount: 1,
        usableRatio: 0.85,
      }).reason,
      /not a preference for circular/i,
    );
  });

  it("marks elongated or necked geometry as review without claiming constructability", () => {
    const corridor = compactnessScore(10_000, 2_000);
    const review = geometryQualityFromMetrics({
      compactness: corridor,
      coreAreaRatio: 0.3,
      aspectRatio: 8,
      partCount: 1,
    });
    assert.equal(review.label, "review");
    assert.match(review.reason, /not constructability/i);
    const fragmented = geometryQualityFromMetrics({ compactness: 0.7, coreAreaRatio: 0.9, partCount: 3 });
    assert.equal(fragmented.label, "review");
  });

  it("names sites from municipality and bbox direction only", () => {
    assert.equal(
      siteDisplayName({
        municipality: "Hallsberg",
        region: "Örebro",
        longitude: 15.15,
        latitude: 59.15,
        west: 14.9,
        south: 59.1,
        east: 15.4,
        north: 59.4,
        siteIndex: 1,
      }),
      "Hallsberg South - Site 01",
    );
    assert.ok(siteMinSeparationM(15) > 200);
  });
});
