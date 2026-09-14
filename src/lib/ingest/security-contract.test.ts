import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canCreateOrEditOpportunities } from "@/lib/opportunities/authorization";
import { coverageGapMessage } from "@/lib/ingest/coverage";
import { ROADLINK_SOURCE_SLUG } from "@/lib/ingest/coverage-keys";

describe("on-demand ingest security contract", () => {
  it("keeps ingest orchestration behind create/edit opportunity permission", () => {
    assert.equal(canCreateOrEditOpportunities("viewer"), false);
    assert.equal(canCreateOrEditOpportunities("member"), true);
  });

  it("does not put service-role names in customer gap copy", () => {
    const message = coverageGapMessage(ROADLINK_SOURCE_SLUG, "provider timeout");
    assert.doesNotMatch(message, /service_role|SERVICE_ROLE|eyJ/);
  });
});
