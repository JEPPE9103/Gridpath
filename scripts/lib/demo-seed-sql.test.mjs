import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTransactionalResetSql } from "./demo-seed-sql.mjs";
import {
  DEMO_ORG_ID,
  FINAL_PROJECT_COUNT,
  PROJECTS,
  PROMOTED_PROJECT,
  STANDALONE_PROJECT_COUNT,
  countSeededCases,
  countSeededDocuments,
  countSeededRequirements,
} from "./sales-demo-portfolio.mjs";

const operators = {
  vattenfall: { id: "22222222-2222-4222-8222-222222222222", name: "Vattenfall Eldistribution" },
  ellevio: { id: "11111111-1111-4111-8111-111111111111", name: "Ellevio" },
  eon: { id: "33333333-3333-4333-8333-333333333333", name: "E.ON Energidistribution" },
  goteborg: { id: "44444444-4444-4444-8444-444444444444", name: "Göteborg Energi" },
};

describe("demo transactional SQL", () => {
  const sql = buildTransactionalResetSql(operators);

  it("seeds six standalone projects and excludes the promoted Örebro project", () => {
    assert.equal(PROJECTS.length, STANDALONE_PROJECT_COUNT);
    assert.equal(STANDALONE_PROJECT_COUNT + 1, FINAL_PROJECT_COUNT);
    assert.equal(
      PROJECTS.some((project) => project.slug === PROMOTED_PROJECT.slug),
      false,
    );
    assert.match(sql, /insert into public.projects/);
    assert.doesNotMatch(sql, new RegExp(PROMOTED_PROJECT.slug));
    assert.match(sql, /kalmar-south-solar/);
    assert.equal((sql.match(/insert into public.projects \(/g) || []).length, 6);
  });

  it("uses relative SQL dates instead of hard-coded 2026 deadlines", () => {
    assert.match(sql, /current_date \+ 6/);
    assert.match(sql, /current_date - 3/);
    assert.match(sql, /now\(\) - interval '1 days'/);
    assert.doesNotMatch(sql, /2026-09-30/);
    assert.doesNotMatch(sql, /2026-10-31/);
  });

  it("cleans the demo-org Discovery graph before reseeding projects", () => {
    assert.match(sql, /delete from public.opportunity_searches/);
    assert.match(sql, /delete from public.opportunity_search_runs/);
    assert.match(sql, /delete from public.opportunity_run_candidates/);
    assert.match(sql, /delete from public.opportunity_run_zones/);
    assert.match(sql, /delete from public.development_opportunities/);
    assert.match(sql, /delete from public.portfolio_comparisons/);
    const searchesDelete = sql.slice(sql.indexOf("delete from public.opportunity_searches"));
    assert.match(searchesDelete, new RegExp(DEMO_ORG_ID));
  });

  it("keeps connection cases, requirements and documents in the intended range", () => {
    assert.equal(countSeededCases(), 4);
    assert.ok(countSeededRequirements() >= 18 && countSeededRequirements() <= 22);
    assert.equal(countSeededDocuments(), 4);
    assert.doesNotMatch(sql, /storage_path/);
  });

  it("never writes official GI or alerts", () => {
    assert.doesNotMatch(sql, /external_changes/);
    assert.doesNotMatch(sql, /change_impacts/);
    assert.doesNotMatch(sql, /grid_sources/);
    assert.doesNotMatch(sql, /\balerts\b/);
  });
});
