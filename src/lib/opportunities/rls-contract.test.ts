import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canCreateOrEditOpportunities, canPromoteOpportunities, canReadOpportunities } from "./authorization";
import { supportedEvidenceProviders, unsupportedEvidenceProviders } from "./providers";

/**
 * Contract for development_opportunities / opportunity_searches / assessments / events
 * after 20260909170000_development_opportunities.sql.
 *
 * SELECT: organization members including viewer.
 * INSERT/UPDATE: owner, admin, member (private.can_write_organization).
 * DELETE: admin/owner on opportunities, searches, and events.
 * Creates and promote go through SECURITY DEFINER RPCs that re-check membership.
 */
describe("opportunity tenancy and provider contract", () => {
  it("keeps Viewer read-only and Member able to write and promote", () => {
    assert.equal(canReadOpportunities("viewer"), true);
    assert.equal(canCreateOrEditOpportunities("viewer"), false);
    assert.equal(canPromoteOpportunities("viewer"), false);
    assert.equal(canCreateOrEditOpportunities("member"), true);
    assert.equal(canPromoteOpportunities("admin"), true);
  });

  it("does not treat unsupported geodata providers as live evidence", () => {
    assert.ok(supportedEvidenceProviders().some((item) => item.key === "ei-official-covering"));
    assert.ok(unsupportedEvidenceProviders().some((item) => item.key === "natura-2000"));
    assert.equal(
      supportedEvidenceProviders().every((item) => item.status === "supported"),
      true,
    );
  });
});
