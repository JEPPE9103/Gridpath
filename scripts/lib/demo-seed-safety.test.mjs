import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCustomerVisibleNamesClean,
  assertDemoResetConfirmed,
  assertSqlSafe,
  classifyDemoUser,
  collectCustomerVisibleNames,
  parseDemoSeedMode,
  pickDemoActor,
} from "./demo-seed-safety.mjs";
import { DEMO_ORG_ID, DEMO_ORG_NAME, PROJECTS, PRIMARY_SEARCH } from "./sales-demo-portfolio.mjs";

describe("demo seed safety", () => {
  it("parses non-destructive modes", () => {
    assert.equal(parseDemoSeedMode(["node", "script", "--plan"]), "plan");
    assert.equal(parseDemoSeedMode(["node", "script", "--preflight"]), "preflight");
    assert.equal(parseDemoSeedMode(["node", "script", "--validate"]), "validate");
    assert.equal(parseDemoSeedMode(["node", "script"]), "reset");
  });

  it("does not require confirmation for local reset or remote plan", () => {
    assert.doesNotThrow(() =>
      assertDemoResetConfirmed({
        mode: "reset",
        remote: false,
        slug: "noxheim-demo-development",
        env: {},
        argv: ["node", "script"],
      }),
    );
    assert.doesNotThrow(() =>
      assertDemoResetConfirmed({
        mode: "plan",
        remote: true,
        slug: "noxheim-demo-development",
        env: {},
        argv: ["node", "script", "--plan"],
      }),
    );
  });

  it("refuses remote reset without the exact demo slug acknowledgement", () => {
    assert.throws(
      () =>
        assertDemoResetConfirmed({
          mode: "reset",
          remote: true,
          slug: "noxheim-demo-development",
          env: { NOXHEIM_CONFIRM_DEMO_RESET: "northgrid-development-ab" },
          argv: ["node", "script"],
        }),
      /NOXHEIM_CONFIRM_DEMO_RESET/,
    );
  });

  it("accepts remote reset when the exact demo slug is confirmed", () => {
    assert.doesNotThrow(() =>
      assertDemoResetConfirmed({
        mode: "reset",
        remote: true,
        slug: "noxheim-demo-development",
        env: { NOXHEIM_CONFIRM_DEMO_RESET: "noxheim-demo-development" },
        argv: ["node", "script"],
      }),
    );
  });

  it("refuses SQL that mentions official or alert tables", () => {
    assert.throws(
      () =>
        assertSqlSafe("delete from public.alerts where organization_id = '" + DEMO_ORG_ID + "';", {
          demoOrgId: DEMO_ORG_ID,
        }),
      /forbidden table alerts/,
    );
    assert.throws(
      () =>
        assertSqlSafe(
          "delete from public.official_geographic_features where id is not null; -- " + DEMO_ORG_ID,
          { demoOrgId: DEMO_ORG_ID },
        ),
      /forbidden table/,
    );
  });

  it("refuses mutations that are not scoped to the demo org", () => {
    assert.throws(
      () => assertSqlSafe("delete from public.projects;", { demoOrgId: DEMO_ORG_ID }),
      /not scoped to the demo organization/,
    );
  });

  it("keeps customer-visible names free of e2e/proof/test tokens", () => {
    assert.doesNotThrow(() =>
      assertCustomerVisibleNamesClean(
        collectCustomerVisibleNames({
          orgName: DEMO_ORG_NAME,
          projects: PROJECTS,
          searches: [PRIMARY_SEARCH],
        }),
      ),
    );
    assert.throws(
      () => assertCustomerVisibleNamesClean(["Hallsberg BESS proof"]),
      /forbidden token/,
    );
  });

  it("prefers a demo-org-only owner/admin/member and rejects viewers", () => {
    const actor = pickDemoActor([
      { profile_id: "viewer", role: "viewer", other_org_memberships: 0 },
      { profile_id: "shared", role: "owner", other_org_memberships: 1 },
      { profile_id: "demo-only", role: "member", other_org_memberships: 0 },
    ]);
    assert.equal(actor.profileId, "demo-only");
    assert.equal(classifyDemoUser({ role: "viewer", other_org_memberships: 0 }).suitable, false);
  });
});
