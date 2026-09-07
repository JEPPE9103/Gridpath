import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPortfolioAttention, countNeedsAttentionProjects, projectIdsNeedingAttention } from "./portfolio-attention";
import type { PortfolioAttentionProjectInput } from "./types";

function project(
  overrides: Partial<PortfolioAttentionProjectInput> & Pick<PortfolioAttentionProjectInput, "id" | "slug" | "name">,
): PortfolioAttentionProjectInput {
  return {
    stage: "Grid Study",
    connectionCaseStatus: "On Track",
    connectionCaseStatusValue: "on_track",
    hasConnectionCase: true,
    readinessPercent: 50,
    readinessCompleteCount: 2,
    readinessRequiredCount: 4,
    confidence: "High",
    targetCOD: "Q3 2028",
    requirements: [],
    openAlertSeverities: [],
    lastUpdated: "2026-08-31T00:00:00Z",
    ...overrides,
  };
}

describe("buildPortfolioAttention", () => {
  it("orders needs attention ahead of watch and by severity", () => {
    const result = buildPortfolioAttention([
      project({
        id: "1",
        slug: "alpha",
        name: "Alpha BESS",
        connectionCaseStatus: "At Risk",
        connectionCaseStatusValue: "at_risk",
      }),
      project({
        id: "2",
        slug: "beta",
        name: "Beta BESS",
        connectionCaseStatus: "Waiting",
        connectionCaseStatusValue: "waiting",
      }),
      project({
        id: "3",
        slug: "gamma",
        name: "Gamma BESS",
        connectionCaseStatus: "On Track",
        connectionCaseStatusValue: "on_track",
      }),
    ]);

    assert.equal(result.needsAttention.length, 1);
    assert.equal(result.needsAttention[0]?.slug, "alpha");
    assert.equal(result.watch.length, 1);
    assert.equal(result.watch[0]?.slug, "beta");
  });

  it("uses stable name tie-break for equal severity", () => {
    const result = buildPortfolioAttention([
      project({
        id: "1",
        slug: "zulu",
        name: "Zulu BESS",
        connectionCaseStatus: "At Risk",
        connectionCaseStatusValue: "at_risk",
      }),
      project({
        id: "2",
        slug: "alpha",
        name: "Alpha BESS",
        connectionCaseStatus: "At Risk",
        connectionCaseStatusValue: "at_risk",
      }),
    ]);

    assert.deepEqual(
      result.needsAttention.map((item) => item.slug),
      ["alpha", "zulu"],
    );
  });

  it("counts needs-attention KPI from the same list as Portfolio Attention", () => {
    const projects = [
      project({
        id: "1",
        slug: "alpha",
        name: "Alpha BESS",
        connectionCaseStatus: "At Risk",
        connectionCaseStatusValue: "at_risk",
      }),
      project({
        id: "2",
        slug: "beta",
        name: "Beta BESS",
        connectionCaseStatus: "Waiting",
        connectionCaseStatusValue: "waiting",
      }),
      project({
        id: "3",
        slug: "gamma",
        name: "Gamma BESS",
        connectionCaseStatus: "On Track",
        connectionCaseStatusValue: "on_track",
        requirements: [{ required: true, status: "Complete", dueDate: null }],
      }),
    ];
    const result = buildPortfolioAttention(projects);
    assert.equal(countNeedsAttentionProjects(projects), result.needsAttention.length);
    assert.equal(countNeedsAttentionProjects(projects), 1);
    assert.deepEqual([...projectIdsNeedingAttention(projects)], ["1"]);
  });

  it("places unreviewed official changes on watch, not needs-attention", () => {
    const result = buildPortfolioAttention([
      project({
        id: "1",
        slug: "north",
        name: "Stockholm North BESS",
        unreviewedOfficialChangeCount: 2,
        requirements: [{ required: true, status: "Complete", dueDate: null }],
      }),
    ]);
    assert.equal(result.needsAttention.length, 0);
    assert.equal(result.watch.length, 1);
    assert.match(result.watch[0]?.summary ?? "", /official changes need review/);
  });
});
