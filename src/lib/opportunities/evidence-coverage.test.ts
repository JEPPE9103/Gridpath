import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { opportunityConfidenceLabel } from "@/lib/opportunities/catalog";
import { opportunityCopyContainsForbiddenTerm, publicOpportunityError } from "@/lib/opportunities/copy";
import {
  NETWORK_COVERING_NOTE,
  REVIEW_FOOTPRINT_EXPLANATION,
  buildEvidenceCoverage,
  buildEvidenceCoverageFromSnapshot,
  networkCoveringCopy,
  provenanceCustomerLabel,
  recommendationConfidenceCaption,
  screeningFootprintQuality,
  whyCandidateRanks,
  EMPTY_OPPORTUNITIES_TITLE,
  ROAD_NOT_INGESTED_RUN_NOTE,
  visibleRunWarnings,
} from "@/lib/opportunities/evidence-coverage";
import { deriveOpportunityConfidence } from "@/lib/opportunities/screening";

const CORE_EVALUATED = {
  protectedQueried: true,
  protectedOverlapPct: 0,
  naturaQueried: true,
  naturaOverlapPct: 0,
  landCoverQueried: true,
  landCover: { open: 72, forest: 20 },
  landCoverProviderKey: "nv-nmd-2023",
  landCoverResolution: "coarse",
  terrainQueried: true,
  meanSlopeDeg: 2.1,
  terrainProviderKey: "copernicus-dem-glo90",
  terrainResolution: "coarse",
  coveringQueried: true,
  localCoveringName: "Mälarenergi Elnät AB",
  nupCoveringName: null,
  roadQueried: false,
  roadDistanceM: null,
  roadClass: null,
};

describe("evidence coverage", () => {
  it("distinguishes evaluated official evidence from missing categories", () => {
    const coverage = buildEvidenceCoverage(CORE_EVALUATED);
    assert.equal(coverage.evaluatedCount, 5);
    assert.equal(coverage.totalCount, 8);
    const land = coverage.items.find((item) => item.id === "land_cover");
    const roads = coverage.items.find((item) => item.id === "road_access");
    const residential = coverage.items.find((item) => item.id === "residential_proximity");
    const detailed = coverage.items.find((item) => item.id === "detailed_terrain");
    assert.equal(land?.state, "evaluated");
    assert.equal(land?.provenance, "official");
    assert.match(land?.summary ?? "", /NMD 2023/);
    assert.equal(roads?.state, "not_evaluated");
    assert.equal(residential?.state, "not_evaluated");
    assert.equal(detailed?.state, "not_evaluated");
    assert.ok(coverage.missingLabels.includes("Road proximity"));
    assert.ok(coverage.missingLabels.includes("Detailed terrain"));
    assert.equal(land?.sourceDetail?.nativeResolution, "10 m");
    assert.match(land?.sourceDetail?.processingResolution ?? "", /coarser derived/i);
    assert.equal(provenanceCustomerLabel("official"), "Official Source");
    assert.equal(provenanceCustomerLabel("customer_data"), "Customer Entered");
    assert.equal(provenanceCustomerLabel("noxheim_derived"), "Noxheim Derived");
  });

  it("describes intersecting RoadLink as proximity, not access distance", () => {
    const coverage = buildEvidenceCoverage({
      ...CORE_EVALUATED,
      roadQueried: true,
      roadDistanceM: 0,
      roadClass: null,
    });
    const roads = coverage.items.find((item) => item.id === "road_access");
    assert.equal(roads?.label, "Road proximity");
    assert.equal(roads?.state, "evaluated");
    assert.equal(roads?.summary, "Intersects screening geometry");
    assert.doesNotMatch(`${roads?.label} ${roads?.summary}`, /0 m/);
  });

  it("hides the stale RoadLink-not-ingested run note after roads are evaluated", () => {
    const warnings = [
      ROAD_NOT_INGESTED_RUN_NOTE,
      "Results are contiguous candidate areas after supported exclusions, not land parcels.",
    ];
    assert.deepEqual(
      visibleRunWarnings(warnings, { "trafikverket-inspire-roadlink": true }),
      ["Results are contiguous candidate areas after supported exclusions, not land parcels."],
    );
    assert.deepEqual(visibleRunWarnings(warnings, { "trafikverket-inspire-roadlink": false }), warnings);
  });

  it("rebuilds frozen Opportunity evidence from the screening snapshot, including unevaluated roads", () => {
    const coverage = buildEvidenceCoverageFromSnapshot({
      screening: {
        dimensions: [
          {
            key: "environmental",
            completeness: "available",
            sourceKind: "official",
            explanation: "No overlap with protected areas.",
          },
          {
            key: "land_suitability",
            completeness: "available",
            sourceKind: "official",
            explanation: "Open land cover. Coarse slope 2.4°.",
          },
          {
            key: "access",
            completeness: "insufficient",
            sourceKind: "official",
            explanation: "Official road-link evidence was not available for this Candidate.",
          },
          {
            key: "grid_context",
            completeness: "available",
            sourceKind: "official",
            explanation: "Covered by E.ON Energidistribution AB — 8704Å. Capacity not assessed.",
          },
        ],
      },
    });
    assert.ok(coverage);
    assert.equal(coverage?.items.find((item) => item.id === "land_cover")?.state, "evaluated");
    assert.equal(coverage?.items.find((item) => item.id === "road_access")?.state, "not_evaluated");
    assert.equal(coverage?.items.find((item) => item.id === "network_geography")?.state, "evaluated");
    assert.ok((coverage?.evaluatedCount ?? 0) >= 4);
    assert.ok(coverage?.missingLabels.includes("Road proximity"));
  });

  it("does not treat optional provider absence as a search failure", () => {
    const coverage = buildEvidenceCoverage({
      ...CORE_EVALUATED,
      providerAvailability: {
        "trafikverket-inspire-roadlink": false,
        "nv-protected-areas": true,
      },
    });
    const roads = coverage.items.find((item) => item.id === "road_access");
    assert.equal(roads?.state, "not_evaluated");
    assert.doesNotMatch(roads?.summary ?? "", /error|failed/i);
  });

  it("pairs covering geography with a not-capacity note", () => {
    const covering = networkCoveringCopy({
      localName: "Mälarenergi Elnät AB",
      nupName: null,
      queried: true,
    });
    assert.equal(covering.title, "Mälarenergi Elnät AB");
    assert.match(covering.detail, /official geographic covering/i);
    assert.equal(covering.note, NETWORK_COVERING_NOTE);
    assert.equal(opportunityCopyContainsForbiddenTerm(NETWORK_COVERING_NOTE), null);
    assert.match(NETWORK_COVERING_NOTE, /not an indication of available connection capacity/i);
  });

  it("reframes geometry review as footprint quality, not a failed site", () => {
    const review = screeningFootprintQuality("review", null);
    const pass = screeningFootprintQuality("pass", null);
    assert.equal(review.label, "Review footprint");
    assert.equal(review.explanation, REVIEW_FOOTPRINT_EXPLANATION);
    assert.equal(pass.label, "Suitable for screening");
    assert.doesNotMatch(review.label, /fail|bad site/i);
    assert.doesNotMatch(REVIEW_FOOTPRINT_EXPLANATION, /constructability|failed geometry/i);
  });

  it("builds why-it-ranks bullets from existing fields only", () => {
    const reasons = whyCandidateRanks({
      targetFitLabel: "On target",
      targetFitScore: 0.9,
      landCover: { open: 80 },
      meanSlopeDeg: 1.8,
      pctBelowSlope: 94,
      protectedOverlapPct: 0,
      naturaOverlapPct: 0,
      protectedQueried: true,
      naturaQueried: true,
      keyPositive: "Should not be needed",
    });
    assert.ok(reasons.some((item) => /target-area fit/i.test(item)));
    assert.ok(reasons.some((item) => /open land cover/i.test(item)));
    assert.ok(reasons.some((item) => /low observed slope/i.test(item)));
    assert.ok(reasons.some((item) => /protected\/natura/i.test(item)));
    assert.ok(!reasons.some((item) => /road proximity/i.test(item)));
  });

  it("treats nearby official roads as a rank reason and far roads as not a boost", () => {
    const nearby = whyCandidateRanks({
      targetFitLabel: "On target",
      targetFitScore: 0.9,
      landCover: { open: 10 },
      meanSlopeDeg: 9,
      pctBelowSlope: 10,
      protectedOverlapPct: 4,
      naturaOverlapPct: 4,
      protectedQueried: true,
      naturaQueried: true,
      roadQueried: true,
      roadDistanceM: 220,
      maxRoadDistanceM: 1000,
      keyPositive: null,
    });
    assert.ok(nearby.some((item) => /road proximity within screening preference/i.test(item)));
    const far = whyCandidateRanks({
      targetFitLabel: "On target",
      targetFitScore: 0.9,
      landCover: { open: 10 },
      meanSlopeDeg: 9,
      pctBelowSlope: 10,
      protectedOverlapPct: 4,
      naturaOverlapPct: 4,
      protectedQueried: true,
      naturaQueried: true,
      roadQueried: true,
      roadDistanceM: 4200,
      maxRoadDistanceM: 1000,
      keyPositive: null,
    });
    assert.ok(!far.some((item) => /road proximity/i.test(item)));
  });

  it("keeps empty-opportunities copy action-oriented", () => {
    assert.match(EMPTY_OPPORTUNITIES_TITLE, /first development opportunity/i);
  });

  it("does not leak provider stack traces into customer errors", () => {
    assert.equal(
      publicOpportunityError(
        "postgres SQLSTATE 42883 function segment_opportunity_run_into_sites",
        "Could not run geographic screening.",
      ),
      "Could not run geographic screening.",
    );
    assert.equal(
      publicOpportunityError("West must be west of east. Use decimal degrees between -180 and 180.", "fallback"),
      "West must be west of east. Use decimal degrees between -180 and 180.",
    );
  });
});

describe("recommendation confidence semantics", () => {
  it("does not return high while optional evidence remains unevaluated", () => {
    const confidence = deriveOpportunityConfidence({
      availableDimensions: 5,
      officialDimensions: 4,
      criticalUnevaluated: false,
      coreAvailable: 5,
      coreSupported: 5,
      optionalUnevaluated: true,
    });
    assert.equal(confidence, "medium");
    assert.notEqual(opportunityConfidenceLabel(confidence), "High");
    const caption = recommendationConfidenceCaption(
      confidence,
      buildEvidenceCoverage(CORE_EVALUATED),
    );
    assert.match(caption, /moderate/i);
    assert.match(caption, /road proximity/i);
    assert.equal(opportunityCopyContainsForbiddenTerm(caption), null);
  });

  it("allows high only when optional relevant evidence is also evaluated", () => {
    const confidence = deriveOpportunityConfidence({
      availableDimensions: 6,
      officialDimensions: 5,
      criticalUnevaluated: false,
      coreAvailable: 5,
      coreSupported: 5,
      optionalUnevaluated: false,
    });
    assert.equal(confidence, "high");
    assert.match(opportunityConfidenceLabel(confidence), /evaluated evidence/i);
  });

  it("does not treat the old two-official four-available path as high", () => {
    const confidence = deriveOpportunityConfidence({
      availableDimensions: 4,
      officialDimensions: 2,
      criticalUnevaluated: false,
      optionalUnevaluated: true,
    });
    assert.equal(confidence, "medium");
  });
});
