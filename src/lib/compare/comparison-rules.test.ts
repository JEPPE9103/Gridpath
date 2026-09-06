import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAddProjectToComparison,
  canWritePortfolioComparisons,
  planComparisonProjectUpdate,
  validateComparisonProjectCount,
} from "@/lib/compare/comparison-rules";

describe("shared comparison permissions", () => {
  it("allows owner, admin, and member to write", () => {
    assert.equal(canWritePortfolioComparisons("owner"), true);
    assert.equal(canWritePortfolioComparisons("admin"), true);
    assert.equal(canWritePortfolioComparisons("member"), true);
  });

  it("blocks viewer writes", () => {
    assert.equal(canWritePortfolioComparisons("viewer"), false);
  });
});

describe("archived project comparison behavior", () => {
  it("blocks newly adding an archived project", () => {
    const result = canAddProjectToComparison({
      projectOrganizationId: "org-a",
      comparisonOrganizationId: "org-a",
      archivedAt: "2026-01-01T00:00:00Z",
      alreadyInComparison: false,
    });
    assert.equal(result.ok, false);
  });

  it("keeps an archived project that is already in a saved comparison", () => {
    const result = canAddProjectToComparison({
      projectOrganizationId: "org-a",
      comparisonOrganizationId: "org-a",
      archivedAt: "2026-01-01T00:00:00Z",
      alreadyInComparison: true,
    });
    assert.equal(result.ok, true);
  });

  it("does not drop archived ids when planning an in-place update", () => {
    const plan = planComparisonProjectUpdate({
      existingProjectIds: ["active-1", "archived-1"],
      nextProjectIds: ["active-1", "archived-1", "active-2"],
    });
    assert.deepEqual(plan.toKeep, ["active-1", "archived-1"]);
    assert.deepEqual(plan.toAdd, ["active-2"]);
    assert.deepEqual(plan.toRemove, []);
  });
});

describe("comparison tenant isolation", () => {
  it("rejects a project from another organisation", () => {
    const result = canAddProjectToComparison({
      projectOrganizationId: "org-b",
      comparisonOrganizationId: "org-a",
      archivedAt: null,
      alreadyInComparison: false,
    });
    assert.equal(result.ok, false);
  });
});

describe("comparison size", () => {
  it("caps at four projects", () => {
    assert.equal(validateComparisonProjectCount(4), null);
    assert.ok(validateComparisonProjectCount(5));
    assert.ok(validateComparisonProjectCount(0));
  });
});
