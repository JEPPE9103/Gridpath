import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateInviteToken, hashInviteToken } from "@/lib/organization/invite-token";

describe("generateInviteToken", () => {
  it("creates unique raw tokens and stable hashes", () => {
    const first = generateInviteToken();
    const second = generateInviteToken();
    assert.notEqual(first.rawToken, second.rawToken);
    assert.equal(first.tokenHash, hashInviteToken(first.rawToken));
    assert.equal(second.tokenHash, hashInviteToken(second.rawToken));
  });
});
