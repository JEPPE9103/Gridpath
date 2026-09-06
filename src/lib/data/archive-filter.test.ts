import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyArchiveFilter } from "./archive-filter";
import { parseArchiveView } from "@/lib/projects/archive-scope";
import { canArchiveProjects, canDeleteProjects } from "@/lib/projects/authorization";
import { portfolioCapacityMW } from "@/lib/domain/portfolio-capacity";

describe("archive view", () => {
  it("defaults to active", () => {
    assert.equal(parseArchiveView(null), "active");
    assert.equal(parseArchiveView("archived"), "archived");
    assert.equal(parseArchiveView("all"), "all");
  });
});

describe("archive filter", () => {
  it("restricts active queries to archived_at is null", () => {
    const calls: string[] = [];
    const query = {
      is(column: string, value: null) {
        calls.push(`is:${column}:${value}`);
        return query;
      },
      not(column: string, operator: string, value: null) {
        calls.push(`not:${column}:${operator}:${value}`);
        return query;
      },
    };
    applyArchiveFilter(query, "active");
    applyArchiveFilter(query, "archived");
    applyArchiveFilter(query, "all");
    assert.deepEqual(calls, ["is:archived_at:null", "not:archived_at:is:null"]);
  });
});

describe("archive permissions", () => {
  it("lets members archive and restore, but only owner/admin hard-delete", () => {
    assert.equal(canArchiveProjects("member"), true);
    assert.equal(canArchiveProjects("viewer"), false);
    assert.equal(canDeleteProjects("member"), false);
    assert.equal(canDeleteProjects("owner"), true);
  });
});

describe("active MW rule", () => {
  it("matches the SQL portfolio capacity helper used by aggregates", () => {
    assert.equal(portfolioCapacityMW({ importMW: 10, exportMW: 40 }), 40);
    assert.equal(portfolioCapacityMW({ importMW: 12, exportMW: 0 }), 12);
    assert.equal(portfolioCapacityMW({ importMW: 0, exportMW: 0 }), 0);
  });
});
