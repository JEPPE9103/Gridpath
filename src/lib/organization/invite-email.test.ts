import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inviteCreatedMessage,
  inviteResentMessage,
} from "@/lib/organization/invite-email";

describe("invitation email copy", () => {
  it("never claims email sent when delivery is not configured", () => {
    const created = inviteCreatedMessage({ sent: false, reason: "not_configured" });
    const resent = inviteResentMessage({ sent: false, reason: "not_configured" });
    assert.equal(created.includes("Email sent"), false);
    assert.equal(resent.includes("Email sent"), false);
    assert.match(created, /not configured/i);
  });

  it("never claims email sent when the provider rejects the request", () => {
    const created = inviteCreatedMessage({ sent: false, reason: "provider_rejected" });
    assert.equal(created.toLowerCase().includes("email sent"), false);
    assert.match(created, /did not accept/i);
  });

  it("uses sent copy only after the provider accepts the request", () => {
    const created = inviteCreatedMessage({ sent: true });
    assert.match(created, /Invitation email sent/);
  });
});
