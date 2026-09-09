import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveStrategicFlags,
  explainRankChange,
  landCoverEvidenceLabel,
  MAX_REFINE_CANDIDATES,
  terrainEvidenceLabel,
} from "./precision";
import { nmd2023ClassToGroup, nmdClassToGroup as mapNmd } from "./land-cover";
import {
  emptyOfficialTransmissionContext,
  officialTransmissionCopy,
  strategicTransmissionScore,
  SVK_CAPACITY_LIMITATION,
} from "./transmission-context";
import {
  lantmaterietCredentialsConfigured,
  lantmaterietStatusCopy,
  resolveLantmaterietState,
} from "./lantmateriet";
import { RANKING_WEIGHTS_V3 } from "./run-ranking";
import { opportunityCopyContainsForbiddenTerm } from "./copy";

describe("precision screening architecture", () => {
  it("keeps detailed refinement bounded and labels coarse vs detailed evidence", () => {
    assert.equal(MAX_REFINE_CANDIDATES, 5);
    assert.match(
      terrainEvidenceLabel({ resolution: "coarse", providerKey: "copernicus-dem-glo90" }),
      /Coarse — Copernicus/,
    );
    assert.match(
      terrainEvidenceLabel({ resolution: "detailed", providerKey: "lantmateriet-dtm-1m" }),
      /Detailed — Lantmäteriet 1 m/,
    );
    assert.match(
      landCoverEvidenceLabel({ resolution: "detailed", providerKey: "nv-nmd-2023" }),
      /Detailed — NMD 2023/,
    );
    assert.match(
      landCoverEvidenceLabel({ resolution: "coarse", providerKey: "nv-nmd-2018" }),
      /Legacy fallback — NMD 2018/,
    );
  });

  it("maps NMD 2023 class 41 as open land, not NMD 2018 forest", () => {
    assert.equal(mapNmd(41, "nmd_2018"), "forest");
    assert.equal(nmd2023ClassToGroup(41), "open");
    assert.equal(mapNmd(41, "nmd_2023_v0"), "open");
    assert.equal(nmd2023ClassToGroup(51), "developed");
    assert.equal(nmd2023ClassToGroup(20), "wetland");
  });

  it("explains discovery vs detailed rank changes from area evidence", () => {
    const text = explainRankChange({
      name: "Hallsberg South",
      discoveryRank: 1,
      detailedRank: 5,
      discoveryContiguousHa: 24.2,
      refinedContiguousHa: 8.1,
    });
    assert.match(text ?? "", /24\.2 ha to 8\.1 ha/);
    assert.match(text ?? "", /Discovery rank #1/);
  });

  it("never treats SvK county indication as a ranking bonus or site capacity", () => {
    const context = emptyOfficialTransmissionContext("Örebro");
    assert.equal(context.available, false);
    assert.equal(strategicTransmissionScore(context), 0);
    const copy = officialTransmissionCopy(context);
    assert.match(copy, /does not estimate project-level grid capacity/i);
    assert.equal(opportunityCopyContainsForbiddenTerm(copy), null);
    assert.match(SVK_CAPACITY_LIMITATION, /does not indicate available capacity at this candidate site/);
  });

  it("reports Lantmäteriet AUTH_REQUIRED without blocking Copernicus fallback", () => {
    assert.equal(lantmaterietCredentialsConfigured({}), false);
    assert.equal(
      resolveLantmaterietState({ credentialsConfigured: false, copernicusAvailable: true }),
      "FALLBACK_ACTIVE",
    );
    assert.match(lantmaterietStatusCopy("AUTH_REQUIRED"), /not configured/);
  });

  it("keeps ranking v3 weights summing to 1 and emits strategic flags without inventing capacity", () => {
    const sum = Object.values(RANKING_WEIGHTS_V3).reduce((total, value) => {
      return typeof value === "number" ? total + value : total;
    }, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
    const flags = deriveStrategicFlags({
      contiguousHa: 22,
      minAreaHa: 8,
      terrainFavorable: true,
      environmentalConflict: false,
      roadDistanceM: 310,
      maxRoadDistanceM: 1000,
      localCovered: true,
      nupCovered: true,
      transmissionAvailable: false,
      highApplicationVolume: false,
      criticalGap: false,
    });
    assert.ok(flags.includes("LARGE_CONTIGUOUS_AREA"));
    assert.ok(flags.includes("GRID_CONTEXT_PRESENT"));
    assert.ok(!flags.includes("OFFICIAL_TRANSMISSION_CONTEXT_AVAILABLE"));
  });
});
