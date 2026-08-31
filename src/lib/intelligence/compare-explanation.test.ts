import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateDevelopmentProfile } from "../domain/development-profile";
import { buildDevelopmentProfileExplanation } from "./compare-explanation";

describe("buildDevelopmentProfileExplanation", () => {
  it("mentions favourable outlook and readiness from visible factors", () => {
    const input = {
      outlook: "Favourable" as const,
      confidence: "High" as const,
      stage: "Application" as const,
      readinessPercent: 100,
      openCriticalAlerts: 0,
      openWarningAlerts: 0,
      connectionCaseStatus: "On Track",
    };
    const explanation = buildDevelopmentProfileExplanation(input);
    const profile = calculateDevelopmentProfile(input);
    assert.match(explanation, /favourable/i);
    assert.match(explanation, /100% application readiness|application readiness/i);
    for (const factor of profile.factors.filter((item) => item.points !== 0)) {
      assert.ok(
        explanation.toLowerCase().includes(factor.label.toLowerCase().split(" ")[0]) ||
          factor.key === "stage",
      );
    }
  });

  it("explains at-risk case using the same factor inputs", () => {
    const input = {
      outlook: "Possible" as const,
      confidence: "Medium" as const,
      stage: "Grid Study" as const,
      readinessPercent: 44,
      openCriticalAlerts: 0,
      openWarningAlerts: 0,
      connectionCaseStatus: "At Risk",
    };
    const explanation = buildDevelopmentProfileExplanation(input);
    assert.match(explanation.toLowerCase(), /at risk|connection case/);
  });

  it("prefixes strongest profile in a comparison", () => {
    const input = {
      outlook: "Favourable" as const,
      confidence: "High" as const,
      stage: "Application" as const,
      readinessPercent: 100,
      openCriticalAlerts: 0,
      openWarningAlerts: 0,
      connectionCaseStatus: "On Track",
    };
    const explanation = buildDevelopmentProfileExplanation(input, {
      isHighestInComparison: true,
      comparisonSize: 3,
    });
    assert.match(explanation, /Strongest current development profile in this comparison/i);
  });
});
