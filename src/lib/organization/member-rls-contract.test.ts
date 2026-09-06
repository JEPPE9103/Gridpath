import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAssignMemberRole, canInviteRole, canManageTargetMember } from "./team-permissions";

/**
 * Contract for organization_members writes after
 * `20260904190000_v1_integrity_membership_snapshots.sql`.
 *
 * Authenticated clients cannot INSERT/UPDATE/DELETE the table directly.
 * Role changes go through SECURITY DEFINER RPCs that reuse this matrix.
 */
describe("organization_members write contract", () => {
  it("blocks admin from assigning owner through the shared role matrix", () => {
    assert.equal(canAssignMemberRole("admin", "member", "owner"), false);
    assert.equal(canInviteRole("admin", "owner"), false);
  });

  it("blocks admin from assigning admin", () => {
    assert.equal(canAssignMemberRole("admin", "member", "admin"), false);
    assert.equal(canManageTargetMember("admin", "admin"), false);
  });

  it("allows owner to assign owner when the RPC last-owner check also passes", () => {
    assert.equal(canAssignMemberRole("owner", "admin", "owner"), true);
    assert.equal(canInviteRole("owner", "owner"), true);
  });

  it("prevents member and viewer from managing roles", () => {
    assert.equal(canAssignMemberRole("member", "viewer", "member"), false);
    assert.equal(canAssignMemberRole("viewer", "member", "viewer"), false);
    assert.equal(canManageTargetMember("member", "viewer"), false);
  });
});
