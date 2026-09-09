import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canCreateOrEditOpportunities, canPromoteOpportunities, canReadOpportunities } from "./authorization";
import { supportedEvidenceProviders, unsupportedEvidenceProviders } from "./providers";

/**
 * Contract for development_opportunities / opportunity_searches / assessments / events
 * after 20260909170000_development_opportunities.sql and
 * 20260910120000_swedish_opportunity_screening.sql.
 *
 * SELECT: organization members including viewer.
 * INSERT/UPDATE: owner, admin, member (private.can_write_organization).
 * DELETE: admin/owner on opportunities, searches, runs, candidates, and events.
 * Official geographic features are a global catalog (authenticated SELECT), like grid_areas.
 * Creates, screening runs, save-candidate and promote go through SECURITY DEFINER RPCs that re-check membership.
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
    assert.ok(supportedEvidenceProviders().some((item) => item.key === "nv-protected-areas"));
    assert.ok(supportedEvidenceProviders().some((item) => item.key === "nv-natura-2000"));
    assert.ok(unsupportedEvidenceProviders().some((item) => item.key === "residential-distance"));
    assert.ok(unsupportedEvidenceProviders().some((item) => item.key === "grid-infrastructure"));
    assert.ok(supportedEvidenceProviders().some((item) => item.key === "copernicus-dem-glo90"));
    assert.ok(supportedEvidenceProviders().some((item) => item.key === "nv-nmd-2023"));
    assert.ok(supportedEvidenceProviders().some((item) => item.key === "nv-nmd-2018"));
    assert.ok(supportedEvidenceProviders().some((item) => item.key === "lantmateriet-dtm-1m"));
    assert.ok(supportedEvidenceProviders().some((item) => item.key === "scb-administrative-areas"));
    assert.ok(supportedEvidenceProviders().some((item) => item.key === "trafikverket-inspire-roadlink"));
    assert.ok(unsupportedEvidenceProviders().some((item) => item.key === "svk-indicative-transmission-2026"));
    assert.ok(unsupportedEvidenceProviders().some((item) => item.key === "electricity-area-geometry"));
    assert.equal(
      supportedEvidenceProviders().every((item) => item.status === "supported"),
      true,
    );
  });
});
