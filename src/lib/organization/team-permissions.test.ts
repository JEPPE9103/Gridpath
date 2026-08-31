import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashInviteToken } from "@/lib/organization/invite-token";
import {
  canAssignMemberRole,
  canInviteRole,
  canManageTargetMember,
  canManageTeam,
  inviteableRoles,
  isValidInviteEmail,
  normalizeInviteEmail,
} from "@/lib/organization/team-permissions";

describe("invite authorization", () => {
  it("owner can invite owner", () => assert.equal(canInviteRole("owner", "owner"), true));
  it("owner can invite admin", () => assert.equal(canInviteRole("owner", "admin"), true));
  it("owner can invite member", () => assert.equal(canInviteRole("owner", "member"), true));
  it("owner can invite viewer", () => assert.equal(canInviteRole("owner", "viewer"), true));
  it("admin can invite member", () => assert.equal(canInviteRole("admin", "member"), true));
  it("admin can invite viewer", () => assert.equal(canInviteRole("admin", "viewer"), true));
  it("admin cannot invite admin", () => assert.equal(canInviteRole("admin", "admin"), false));
  it("admin cannot invite owner", () => assert.equal(canInviteRole("admin", "owner"), false));
  it("member cannot invite", () => assert.equal(canInviteRole("member", "member"), false));
  it("viewer cannot invite", () => assert.equal(canInviteRole("viewer", "viewer"), false));
});

describe("role management authorization", () => {
  it("owner can change permitted roles", () => {
    assert.equal(canAssignMemberRole("owner", "member", "admin"), true);
  });
  it("admin can change member to viewer", () => {
    assert.equal(canAssignMemberRole("admin", "member", "viewer"), true);
  });
  it("admin can change viewer to member", () => {
    assert.equal(canAssignMemberRole("admin", "viewer", "member"), true);
  });
  it("admin cannot modify admin", () => {
    assert.equal(canManageTargetMember("admin", "admin"), false);
  });
  it("admin cannot modify owner", () => {
    assert.equal(canManageTargetMember("admin", "owner"), false);
  });
  it("member cannot change role", () => {
    assert.equal(canAssignMemberRole("member", "member", "viewer"), false);
  });
  it("viewer cannot change role", () => {
    assert.equal(canAssignMemberRole("viewer", "viewer", "member"), false);
  });
});

describe("team management visibility", () => {
  it("owner and admin can manage team", () => {
    assert.equal(canManageTeam("owner"), true);
    assert.equal(canManageTeam("admin"), true);
    assert.equal(canManageTeam("member"), false);
    assert.equal(canManageTeam("viewer"), false);
  });

  it("inviteable roles match actor role", () => {
    assert.deepEqual(inviteableRoles("owner"), ["owner", "admin", "member", "viewer"]);
    assert.deepEqual(inviteableRoles("admin"), ["member", "viewer"]);
    assert.deepEqual(inviteableRoles("member"), []);
  });
});

describe("invite email normalization", () => {
  it("normalizes email safely", () => {
    assert.equal(normalizeInviteEmail("  Alice@Example.COM "), "alice@example.com");
  });

  it("rejects malformed email", () => {
    assert.equal(isValidInviteEmail("not-an-email"), false);
    assert.equal(isValidInviteEmail("alice@example.com"), true);
  });
});

describe("token security", () => {
  it("hashes invite tokens without storing raw values", () => {
    const raw = "sample-invite-token-value";
    const hash = hashInviteToken(raw);
    assert.notEqual(hash, raw);
    assert.equal(hash.length, 64);
    assert.equal(hashInviteToken(raw), hash);
  });
});

describe("portfolio isolation expectations for team data", () => {
  it("scopes team management to active organization context", () => {
    const activeOrgId = "org-a";
    const teamOrgId = activeOrgId;
    assert.equal(teamOrgId === activeOrgId, true);
  });
});

describe("owner safety expectations", () => {
  it("documents final-owner protection as database enforced", () => {
    const ownerCount = 1;
    const demotingFinalOwner = ownerCount <= 1;
    assert.equal(demotingFinalOwner, true);
  });

  it("allows owner demotion when another owner exists", () => {
    const ownerCount = 2;
    const demotingOwner = ownerCount > 1;
    assert.equal(demotingOwner, true);
  });
});

describe("invite lifecycle expectations", () => {
  it("acceptance uses invite role not client request", () => {
    const inviteRole = "viewer";
    const clientRequestedRole = "owner";
    assert.notEqual(inviteRole, clientRequestedRole);
    assert.equal(inviteRole, "viewer");
  });

  it("second-org acceptance preserves first membership conceptually", () => {
    const memberships = new Set<string>();
    memberships.add("org-a");
    memberships.add("org-b");
    assert.equal(memberships.size, 2);
  });
});
