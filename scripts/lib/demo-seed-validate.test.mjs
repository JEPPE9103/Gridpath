import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateDemoState } from "./demo-seed-validate.mjs";
import { DEMO_ORG_ID, DEMO_ORG_SLUG, PRIMARY_SEARCH, PROMOTED_PROJECT } from "./sales-demo-portfolio.mjs";

describe("demo post-reset validation", () => {
  const inventory = {
    searches: 1,
    runs: 1,
    candidates: 18,
    zones: 8,
    opportunities: 5,
    comparisons: 0,
    projects: 7,
    connection_cases: 4,
    requirements: 21,
    documents: 4,
    other_org_projects: 12,
    other_organizations: 3,
    demo_alerts: 0,
    external_changes: 4,
  };

  it("accepts a complete Opportunity → Project workspace", () => {
    const promotedId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const projectId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const result = evaluateDemoState({
      org: { id: DEMO_ORG_ID, slug: DEMO_ORG_SLUG, name: "Northfield Energy Development AB" },
      inventory,
      beforeInventory: { ...inventory, projects: 10, searches: 4 },
      projects: [
        { id: projectId, name: PROMOTED_PROJECT.name, slug: PROMOTED_PROJECT.slug, originating_opportunity_id: promotedId },
      ],
      opportunities: [
        { id: promotedId, name: PROMOTED_PROJECT.name, status: "promoted", promoted_project_id: projectId },
        { id: "2", name: "Site B", status: "shortlisted", promoted_project_id: null },
        { id: "3", name: "Site C", status: "under_review", promoted_project_id: null },
        { id: "4", name: "Site D", status: "screening", promoted_project_id: null },
        { id: "5", name: "Site E", status: "rejected", promoted_project_id: null },
      ],
      searches: [{ id: "s1", name: PRIMARY_SEARCH.name }],
    });
    assert.equal(result.ok, true);
  });

  it("fails when leftover proof names or missing promotion remain", () => {
    const result = evaluateDemoState({
      org: { id: DEMO_ORG_ID, slug: DEMO_ORG_SLUG, name: "Northfield Energy Development AB" },
      inventory: { ...inventory, projects: 6, opportunities: 0, searches: 0, runs: 0, candidates: 0 },
      projects: [{ id: "p", name: "Hallsberg BESS proof", slug: "hallsberg-bess-proof", originating_opportunity_id: null }],
      opportunities: [],
      searches: [],
    });
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((item) => /Forbidden customer-visible name/.test(item)));
  });
});
