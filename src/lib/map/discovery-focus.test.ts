import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DISCOVERY_FIT_DURATION_MS,
  discoveryFitBoundsInput,
  expandBboxForDiscoveryFit,
  shouldRefitDiscoveryRun,
} from "./discovery-focus";

describe("discovery map focus", () => {
  it("fits a Search Area once per run with a smooth duration", () => {
    assert.equal(shouldRefitDiscoveryRun(null, "run-a"), true);
    assert.equal(shouldRefitDiscoveryRun("run-a", "run-a"), false);
    assert.equal(shouldRefitDiscoveryRun("run-a", "run-b"), true);
    const fit = discoveryFitBoundsInput(
      { west: 12.99, south: 55.60, east: 13.01, north: 55.61 },
      { top: 16, right: 320, bottom: 40, left: 48 },
    );
    assert.equal(fit.options.duration, DISCOVERY_FIT_DURATION_MS);
    assert.ok(fit.options.duration >= 600 && fit.options.duration <= 900);
    assert.equal(fit.options.maxZoom, 11);
    const expanded = expandBboxForDiscoveryFit({ west: 13, south: 55.6, east: 13.01, north: 55.61 });
    assert.ok(expanded.east - expanded.west >= 0.12);
  });
});
