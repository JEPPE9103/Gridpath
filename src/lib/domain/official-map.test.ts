import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COVERING_OFFICIAL_AREA_LABEL,
  DEFAULT_OFFICIAL_MAP_LAYERS,
  LOCAL_NETWORK_UNMATCHED_BODY,
  NUP_FORECAST_NEED_MAP_DISCLAIMER,
  NUP_UNMATCHED_BODY,
  assertOfficialMapPayloadIsCustomerSafe,
  coveringFeatureIds,
  isOfficialMapLayer,
  isUnmatchedReviewProject,
  officialMapCopyContainsForbiddenTerm,
  officialMapSimplifyTolerance,
  parseOfficialMapFeatureCollection,
  parseOfficialSpatialMatches,
  summarizeOfficialSpatialMatches,
  unmatchedLocalNetworkCopy,
  unmatchedNupCopy,
} from "@/lib/domain/official-map";

describe("official map geometry helpers", () => {
  it("maps zoom to simplify tolerances used by the RPC", () => {
    assert.equal(officialMapSimplifyTolerance(4.35), 0.02);
    assert.equal(officialMapSimplifyTolerance(7), 0.008);
    assert.equal(officialMapSimplifyTolerance(11), 0.002);
  });

  it("accepts only official layer ids", () => {
    assert.equal(isOfficialMapLayer("local_network"), true);
    assert.equal(isOfficialMapLayer("planning_area"), true);
    assert.equal(isOfficialMapLayer("capacity_area"), false);
  });
});

describe("official spatial summary", () => {
  it("counts local/nup matches without inventing a grid score", () => {
    const summary = summarizeOfficialSpatialMatches({
      activeProjects: 10,
      plottableProjectIds: ["a", "b", "c", "d"],
      matches: [
        { projectId: "a", localAreaId: "ln-1", nupAreaId: "nup-1" },
        { projectId: "b", localAreaId: "ln-2", nupAreaId: null },
        { projectId: "c", localAreaId: null, nupAreaId: "nup-2" },
        { projectId: "other-org", localAreaId: "ln-x", nupAreaId: "nup-x" },
      ],
    });
    assert.equal(summary.activeProjects, 10);
    assert.equal(summary.withCoordinates, 4);
    assert.equal(summary.localMatched, 2);
    assert.equal(summary.nupMatched, 2);
    assert.equal(summary.unmatched, 3);
  });

  it("ignores matches for other organisations when project ids are scoped", () => {
    const summary = summarizeOfficialSpatialMatches({
      activeProjects: 1,
      plottableProjectIds: ["tenant-a"],
      matches: [{ projectId: "tenant-b", localAreaId: "ln-1", nupAreaId: "nup-1" }],
    });
    assert.equal(summary.localMatched, 0);
    assert.equal(summary.nupMatched, 0);
    assert.equal(summary.unmatched, 1);
  });

  it("treats missing coordinates and missing covering as unmatched review", () => {
    assert.equal(isUnmatchedReviewProject(undefined, false), true);
    assert.equal(
      isUnmatchedReviewProject({ projectId: "a", localAreaId: "ln", nupAreaId: "nup" }, true),
      false,
    );
    assert.equal(
      isUnmatchedReviewProject({ projectId: "a", localAreaId: "ln", nupAreaId: null }, true),
      true,
    );
  });

  it("returns covering area ids for project highlight", () => {
    assert.deepEqual(
      coveringFeatureIds({ projectId: "a", localAreaId: "ln-1", nupAreaId: "nup-1" }),
      ["ln-1", "nup-1"],
    );
  });
});

describe("official map copy", () => {
  it("keeps required NUP semantic disclaimer", () => {
    assert.match(NUP_FORECAST_NEED_MAP_DISCLAIMER, /Published forecast transfer-capacity need/);
    assert.match(NUP_FORECAST_NEED_MAP_DISCLAIMER, /does not represent available connection capacity/);
    assert.equal(officialMapCopyContainsForbiddenTerm(NUP_FORECAST_NEED_MAP_DISCLAIMER), null);
  });

  it("describes unmatched as a matching statement, not missing grid", () => {
    const local = unmatchedLocalNetworkCopy({
      dataset: "Ei local-network concessions",
      freshness: "25 Aug 2026",
      latitude: 59.33,
      longitude: 18.07,
      lastFullIngestAt: "25 Aug 2026",
      sourceHealth: "healthy",
    });
    const nup = unmatchedNupCopy({
      dataset: "Elnätsföretagens nätutvecklingsplaner",
      freshness: "25 Aug 2026",
      latitude: 59.33,
      longitude: 18.07,
      lastFullIngestAt: "25 Aug 2026",
      sourceHealth: "Healthy",
    });
    assert.equal(local.body, LOCAL_NETWORK_UNMATCHED_BODY);
    assert.equal(nup.body, NUP_UNMATCHED_BODY);
    assert.equal(officialMapCopyContainsForbiddenTerm(local.body), null);
    assert.equal(officialMapCopyContainsForbiddenTerm(nup.body), null);
    assert.equal(officialMapCopyContainsForbiddenTerm("No grid exists here."), "no grid exists here");
    assert.equal(officialMapCopyContainsForbiddenTerm("No capacity."), "no capacity");
    assert.ok(local.details.some((line) => line.includes("59.3300, 18.0700")));
    assert.ok(nup.details.some((line) => line.startsWith("Source status:")));
  });

  it("uses covering official area language, not connection-point language", () => {
    assert.equal(COVERING_OFFICIAL_AREA_LABEL, "Covering official area");
    assert.equal(officialMapCopyContainsForbiddenTerm(COVERING_OFFICIAL_AREA_LABEL), null);
  });

  it("defaults all Grid Intelligence layers on", () => {
    assert.deepEqual(DEFAULT_OFFICIAL_MAP_LAYERS, {
      projects: true,
      localNetwork: true,
      planningArea: true,
    });
  });
});

describe("official map payload boundary", () => {
  it("parses simplified GeoJSON and rejects raw ingest keys", () => {
    const parsed = parseOfficialMapFeatureCollection({
      type: "FeatureCollection",
      truncated: false,
      featureCount: 1,
      provenance: {
        sourceId: "src",
        sourceName: "Ei",
        sourceSlug: "ei-network-area-concessions",
        publisher: "Energimarknadsinspektionen",
        dataType: "Network area concession geography",
      },
      features: [
        {
          type: "Feature",
          id: "area-1",
          geometry: { type: "Polygon", coordinates: [] },
          properties: {
            id: "area-1",
            name: "Stockholm",
            layer: "local_network",
            officialOperatorName: "Ellevio",
          },
        },
      ],
    });
    assert.equal(parsed.features.length, 1);
    assert.equal(parsed.provenance?.publisher, "Energimarknadsinspektionen");
    assert.throws(() =>
      assertOfficialMapPayloadIsCustomerSafe({ raw_content: { secret: true } }),
    );
  });

  it("parses org-scoped spatial matches", () => {
    const matches = parseOfficialSpatialMatches([
      { projectId: "p1", localAreaId: "ln", nupAreaId: null },
    ]);
    assert.equal(matches[0]?.localAreaId, "ln");
    assert.equal(matches[0]?.nupAreaId, null);
  });
});
