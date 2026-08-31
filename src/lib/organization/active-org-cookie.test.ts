import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  activeOrganizationCookieAttributes,
  isOrganizationId,
} from "@/lib/organization/active-org-cookie-constants";

describe("activeOrganizationCookieAttributes", () => {
  it("sets persistent httpOnly lax cookie options for active workspace", () => {
    const options = activeOrganizationCookieAttributes(false);
    assert.equal(options.httpOnly, true);
    assert.equal(options.sameSite, "lax");
    assert.equal(options.path, "/");
    assert.ok(options.maxAge > 0);
  });

  it("clears the active workspace cookie on logout", () => {
    const options = activeOrganizationCookieAttributes(true);
    assert.equal(options.httpOnly, true);
    assert.equal(options.sameSite, "lax");
    assert.equal(options.path, "/");
    assert.equal(options.maxAge, 0);
  });

  it("uses secure cookies in production", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      assert.equal(activeOrganizationCookieAttributes(false).secure, true);
      assert.equal(activeOrganizationCookieAttributes(true).secure, true);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});

describe("logout cookie contract", () => {
  it("uses the expected cookie name for workspace preference", () => {
    assert.equal(ACTIVE_ORGANIZATION_COOKIE, "noxheim_active_organization");
  });

  it("rejects forged non-uuid cookie values before use", () => {
    assert.equal(isOrganizationId("forged-org-id"), false);
  });
});
