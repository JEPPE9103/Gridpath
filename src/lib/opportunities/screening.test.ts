import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canCreateOrEditOpportunities, canReadOpportunities } from "@/lib/opportunities/authorization";
import { opportunityCopyContainsForbiddenTerm } from "@/lib/opportunities/copy";
import { technologyToProjectDb } from "@/lib/opportunities/catalog";
import {
  emptyCovering,
  evaluateOpportunityScreening,
  type OpportunityCandidate,
  type ScreeningCriteria,
} from "@/lib/opportunities/screening";

const CRITERIA: ScreeningCriteria = {
  technology: "battery_storage",
  country: "SE",
  region: "Örebro",
  municipality: null,
  targetMw: 50,
  targetMwh: 100,
  minSiteAreaHa: 2,
  maxDistanceKm: 10,
  excludeProtected: true,
  excludeNatura: true,
  maxSlopePercent: 8,
  minDistanceResidentialM: 200,
  notes: "Customer screening memo",
};

function candidate(overrides: Partial<OpportunityCandidate> = {}): OpportunityCandidate {
  return {
    name: "Örebro South",
    country: "SE",
    region: "Örebro",
    municipality: "Örebro",
    latitude: 59.27,
    longitude: 15.21,
    targetMw: 40,
    targetMwh: 80,
    siteAreaHa: 6,
    technology: "battery_storage",
    covering: emptyCovering(),
    ...overrides,
  };
}

describe("opportunity authorization", () => {
  it("matches project write matrix and keeps Viewer read-only", () => {
    assert.equal(canCreateOrEditOpportunities("viewer"), false);
    assert.equal(canCreateOrEditOpportunities("member"), true);
    assert.equal(canReadOpportunities("viewer"), true);
  });
});

describe("opportunity screening", () => {
  it("does not eliminate candidates when protected-area layers are unavailable", () => {
    const result = evaluateOpportunityScreening({
      criteria: CRITERIA,
      candidate: candidate(),
    });
    assert.equal(result.excluded, false);
    const environmental = result.dimensions.find((item) => item.key === "environmental");
    assert.equal(environmental?.completeness, "insufficient");
    assert.match(environmental?.explanation ?? "", /no supported/i);
    assert.equal(result.recommendation, "insufficient_evidence");
  });

  it("uses official covering as grid context, not capacity", () => {
    const result = evaluateOpportunityScreening({
      criteria: CRITERIA,
      candidate: candidate({
        covering: {
          queried: true,
          localCovered: true,
          nupCovered: true,
          localName: "Örebro Elnät",
          nupName: "SE3 illustrative plan",
          retrievedAt: "2026-09-01T00:00:00Z",
          sourceName: "Ei",
        },
      }),
    });
    assert.equal(result.recommendation, "prioritise");
    assert.equal(result.status, "strong_candidate");
    const grid = result.dimensions.find((item) => item.key === "grid_context");
    assert.equal(grid?.result, "strong");
    assert.equal(grid?.sourceKind, "official");
    assert.match(grid?.explanation ?? "", /not mean available capacity/i);
    assert.equal(opportunityCopyContainsForbiddenTerm(result.recommendationSummary), null);
    assert.ok(result.risks.some((item) => /unconfirmed/i.test(item)));
  });

  it("applies hard region and area constraints from customer criteria", () => {
    const region = evaluateOpportunityScreening({
      criteria: CRITERIA,
      candidate: candidate({ region: "Västerås" }),
    });
    assert.equal(region.excluded, true);
    assert.match(region.exclusionReason ?? "", /region/i);
    assert.equal(region.recommendation, "low_priority");

    const area = evaluateOpportunityScreening({
      criteria: CRITERIA,
      candidate: candidate({ siteAreaHa: 0.5 }),
    });
    assert.equal(area.excluded, true);
    assert.match(area.exclusionReason ?? "", /site area/i);
  });

  it("does not pretend unsupported countries have Swedish official layers", () => {
    const result = evaluateOpportunityScreening({
      criteria: { ...CRITERIA, country: "FI" },
      candidate: candidate({
        country: "FI",
        covering: {
          queried: true,
          localCovered: true,
          nupCovered: true,
          localName: "Should not apply",
          nupName: null,
          retrievedAt: null,
          sourceName: null,
        },
      }),
    });
    const grid = result.dimensions.find((item) => item.key === "grid_context");
    assert.equal(grid?.completeness, "insufficient");
    assert.equal(result.recommendation, "insufficient_evidence");
  });

  it("uses one covering layer as investigate, not a connection verdict", () => {
    const result = evaluateOpportunityScreening({
      criteria: CRITERIA,
      candidate: candidate({
        covering: {
          queried: true,
          localCovered: true,
          nupCovered: false,
          localName: "Örebro Elnät",
          nupName: null,
          retrievedAt: "2026-09-01T00:00:00Z",
          sourceName: "Ei",
        },
      }),
    });
    assert.equal(result.recommendation, "investigate");
    assert.equal(result.status, "screening");
  });

  it("maps promotion technologies without inventing project types", () => {
    assert.equal(technologyToProjectDb("battery_storage"), "battery_storage");
    assert.equal(technologyToProjectDb("data_center"), "industrial");
    assert.equal(technologyToProjectDb("hybrid"), "other");
    assert.equal(technologyToProjectDb("hydrogen"), "other");
  });
});
