import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveCandidateConstraints, hasBlocker } from "./constraints";
import { deriveNextInvestigations } from "./investigations";
import { buildCandidateIntelligence, parseFrozenIntelligence } from "./candidate-intelligence";
import { defaultScreeningProfile } from "./screening-profiles";
import { opportunityCopyContainsForbiddenTerm } from "./copy";

const BASE = {
  excluded: false,
  exclusionReason: null,
  geometryQuality: "pass" as const,
  geometryQualityReason: null,
  terrainQueried: true,
  meanSlopeDeg: 2.4,
  p90SlopeDeg: 3.1,
  pctBelowSlope: 92,
  terrainResolution: "coarse",
  maxSlopeDegrees: 5,
  slopeMode: "preference" as const,
  roadQueried: false,
  roadDistanceM: null,
  roadClass: null,
  maxRoadDistanceM: 1000,
  roadMode: "preference" as const,
  landCoverQueried: true,
  protectedQueried: true,
  naturaQueried: true,
  excludeProtected: true,
  excludeNatura: true,
  coveringQueried: true,
  localCoveringName: "E.ON Energidistribution",
  nupCoveringName: "SE3 plan",
};

describe("candidate constraints", () => {
  it("treats missing road evidence as UNKNOWN, never a blocker or favourable", () => {
    const constraints = deriveCandidateConstraints(BASE);
    const roads = constraints.find((item) => item.id === "road_unavailable");
    assert.equal(roads?.severity, "unknown");
    assert.equal(roads?.evaluated, false);
    assert.equal(roads?.automaticExclusion, false);
    assert.match(roads?.title ?? "", /not evaluated/i);
    assert.equal(hasBlocker(constraints), false);
    for (const item of constraints) {
      assert.equal(opportunityCopyContainsForbiddenTerm(`${item.title} ${item.explanation}`), null);
    }
  });

  it("does not call missing evidence a blocker", () => {
    const constraints = deriveCandidateConstraints({
      ...BASE,
      terrainQueried: false,
      meanSlopeDeg: null,
      landCoverQueried: false,
    });
    assert.ok(constraints.every((item) => item.severity !== "blocker" || item.id === "screening_exclusion"));
    assert.equal(constraints.find((item) => item.id === "terrain_unavailable")?.severity, "unknown");
    assert.equal(constraints.find((item) => item.id === "land_cover_unavailable")?.severity, "unknown");
  });

  it("marks geometry review as a major risk", () => {
    const constraints = deriveCandidateConstraints({
      ...BASE,
      geometryQuality: "review",
      geometryQualityReason: "elongated envelope",
    });
    assert.equal(constraints.find((item) => item.id === "geometry_review")?.severity, "major_risk");
  });

  it("keeps hard exclusion as a blocker", () => {
    const constraints = deriveCandidateConstraints({
      ...BASE,
      excluded: true,
      exclusionReason: "Natura 2000 overlap 12%",
    });
    assert.equal(hasBlocker(constraints), true);
    assert.equal(constraints[0]?.id, "screening_exclusion");
    assert.equal(constraints[0]?.automaticExclusion, true);
  });

  it("states covering operator without implying capacity", () => {
    const covering = deriveCandidateConstraints(BASE).find(
      (item) => item.id === "network_covering_capacity_unknown",
    );
    assert.equal(covering?.severity, "info");
    assert.match(covering?.title ?? "", /E\.ON Energidistribution/);
    assert.match(covering?.title ?? "", /Capacity not assessed/);
    assert.doesNotMatch(covering?.title ?? "", /grid available|connection likely/i);
  });
});

describe("next investigations", () => {
  it("asks to confirm road access when roads were not evaluated", () => {
    const next = deriveNextInvestigations(deriveCandidateConstraints(BASE));
    assert.ok(next.some((item) => /road access|heavy-vehicle access/i.test(item.action)));
    assert.ok(next.length <= 5);
    assert.equal(next[0]?.priority, "now");
  });

  it("asks for detailed terrain after coarse slope is present", () => {
    const next = deriveNextInvestigations(deriveCandidateConstraints(BASE));
    const detailed = next.find((item) => item.constraintId === "detailed_terrain_unavailable");
    assert.ok(detailed);
    assert.equal(detailed?.priority, "next");
    assert.match(detailed?.action ?? "", /detailed terrain|earthworks/i);
  });

  it("keeps a later connection assessment when covering exists", () => {
    const next = deriveNextInvestigations(deriveCandidateConstraints(BASE));
    const grid = next.find((item) => item.constraintId === "network_covering_capacity_unknown");
    assert.ok(grid);
    assert.equal(grid?.priority, "later");
    assert.match(grid?.action ?? "", /connection separately/i);
  });

  it("orders geometry review ahead of optional later items", () => {
    const next = deriveNextInvestigations(
      deriveCandidateConstraints({ ...BASE, geometryQuality: "review" }),
    );
    assert.equal(next[0]?.constraintId, "geometry_review");
    assert.equal(next[0]?.priority, "now");
  });
});

describe("candidate intelligence snapshot", () => {
  it("round-trips frozen intelligence and still derives from a live candidate", () => {
    const live = buildCandidateIntelligence(
      {
        ...BASE,
        landCover: { open: 70, forest: 20 },
        keyPositive: "Open land",
        keyRisk: "Road access is not evaluated",
        targetFitLabel: "On target",
        targetFitScore: 0.9,
        protectedOverlapPct: 0,
        naturaOverlapPct: 0,
      },
      defaultScreeningProfile("battery_storage").criteria,
    );
    const frozen = parseFrozenIntelligence(live);
    assert.equal(frozen?.constraintSemanticsVersion, live.constraintSemanticsVersion);
    assert.ok((frozen?.nextInvestigations.length ?? 0) >= 1);
    assert.equal(parseFrozenIntelligence({}), null);
    const nested = parseFrozenIntelligence({
      screening: { intelligence: live },
      recommendation: "investigate",
    });
    assert.equal(nested?.version, live.version);
    assert.equal(nested?.nextInvestigations[0]?.id, live.nextInvestigations[0]?.id);
  });
});
