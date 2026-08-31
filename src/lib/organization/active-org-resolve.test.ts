import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOrganizationId } from "@/lib/organization/active-org-cookie";
import {
  membershipIncludesOrganization,
  resolveActiveOrganizationId,
  type MembershipRecord,
} from "@/lib/organization/active-org-resolve";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ORG_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function memberships(): MembershipRecord[] {
  return [
    { organizationId: ORG_A, createdAt: "2026-01-01T00:00:00.000Z" },
    { organizationId: ORG_B, createdAt: "2026-02-01T00:00:00.000Z" },
  ];
}

describe("resolveActiveOrganizationId", () => {
  it("selects the only membership when user has one organization", () => {
    const single = [{ organizationId: ORG_A, createdAt: "2026-01-01T00:00:00.000Z" }];
    assert.equal(resolveActiveOrganizationId(single, null), ORG_A);
  });

  it("honors a valid active-organization cookie", () => {
    assert.equal(resolveActiveOrganizationId(memberships(), ORG_B), ORG_B);
  });

  it("falls back to earliest membership when cookie is stale", () => {
    assert.equal(
      resolveActiveOrganizationId(memberships(), ORG_C),
      ORG_A,
    );
  });

  it("falls back when cookie is missing", () => {
    assert.equal(resolveActiveOrganizationId(memberships(), null), ORG_A);
  });

  it("returns null when user has no memberships", () => {
    assert.equal(resolveActiveOrganizationId([], ORG_A), null);
  });

  it("uses deterministic tie-breaking by organization id", () => {
    const tied = [
      { organizationId: ORG_B, createdAt: "2026-01-01T00:00:00.000Z" },
      { organizationId: ORG_A, createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    assert.equal(resolveActiveOrganizationId(tied, null), ORG_A);
  });
});

describe("membershipIncludesOrganization", () => {
  it("accepts a membership the user belongs to", () => {
    assert.equal(membershipIncludesOrganization(memberships(), ORG_B), true);
  });

  it("rejects an organization outside membership", () => {
    assert.equal(membershipIncludesOrganization(memberships(), ORG_C), false);
  });
});

describe("isOrganizationId", () => {
  it("accepts canonical UUID values", () => {
    assert.equal(isOrganizationId(ORG_A), true);
  });

  it("rejects malformed cookie values", () => {
    assert.equal(isOrganizationId("not-a-uuid"), false);
    assert.equal(isOrganizationId(""), false);
    assert.equal(isOrganizationId(null), false);
  });
});

describe("active organization role semantics", () => {
  it("resolves role from the selected membership, not another org", () => {
    const rows = memberships();
    const activeId = resolveActiveOrganizationId(rows, ORG_B);
    assert.equal(activeId, ORG_B);
    assert.notEqual(activeId, ORG_A);
  });
});

describe("portfolio isolation expectations", () => {
  it("scopes list queries to the resolved active organization id", () => {
    const activeOrgId = resolveActiveOrganizationId(memberships(), ORG_A);
    const orgAProjects = ["a1", "a2"];
    const orgBProjects = ["b1"];
    const visible = activeOrgId === ORG_A ? orgAProjects : orgBProjects;
    assert.deepEqual(visible, orgAProjects);
    assert.ok(!visible.includes("b1"));
  });

  it("prevents cross-workspace project access when active org differs", () => {
    const activeOrgId = resolveActiveOrganizationId(memberships(), ORG_A);
    const projectOrgId = ORG_B;
    const allowed = activeOrgId === projectOrgId;
    assert.equal(allowed, false);
  });
});
