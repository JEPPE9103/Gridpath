import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authCallbackUrl, isAllowedAuthNextPath, safeRedirectPath } from "@/lib/auth/redirect";

describe("safeRedirectPath", () => {
  it("rejects open redirects", () => {
    assert.equal(safeRedirectPath("https://evil.example", "/onboarding"), "/onboarding");
    assert.equal(safeRedirectPath("//evil.example", "/onboarding"), "/onboarding");
    assert.equal(safeRedirectPath("/\\evil", "/onboarding"), "/onboarding");
  });

  it("rejects workspace paths that are not allowlisted", () => {
    assert.equal(safeRedirectPath("/map", "/onboarding"), "/onboarding");
    assert.equal(safeRedirectPath("/internal/operations", "/onboarding"), "/onboarding");
  });

  it("allows recovery, onboarding, and invite next paths", () => {
    assert.equal(safeRedirectPath("/reset-password"), "/reset-password");
    assert.equal(safeRedirectPath("/onboarding"), "/onboarding");
    assert.equal(safeRedirectPath("/invite/abc_def-123"), "/invite/abc_def-123");
  });

  it("strips query and hash from next", () => {
    assert.equal(safeRedirectPath("/reset-password?x=1#y"), "/reset-password");
  });
});

describe("isAllowedAuthNextPath", () => {
  it("does not treat a nested invite path as valid", () => {
    assert.equal(isAllowedAuthNextPath("/invite/a/b"), false);
  });
});

describe("authCallbackUrl", () => {
  it("points at the dedicated callback with an encoded next path", () => {
    const url = authCallbackUrl("/reset-password");
    assert.match(url, /\/auth\/callback\?next=%2Freset-password$/);
  });
});
