import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authCallbackForwardSearch,
  resolveAuthCallbackDestination,
} from "@/lib/auth/callback-destination";

describe("resolveAuthCallbackDestination", () => {
  it("preserves recovery intent even if next is a workspace path", () => {
    assert.deepEqual(
      resolveAuthCallbackDestination({ type: "recovery", next: "/portfolio" }),
      { path: "/reset-password", recovery: true },
    );
  });

  it("sends reset-password next to the dedicated recovery page", () => {
    assert.deepEqual(
      resolveAuthCallbackDestination({ type: null, next: "/reset-password" }),
      { path: "/reset-password", recovery: true },
    );
  });

  it("does not default a missing destination into the product or demo workspace", () => {
    assert.deepEqual(resolveAuthCallbackDestination({ type: null, next: null }), {
      path: "/reset-password",
      recovery: true,
    });
  });

  it("routes signup confirmation to onboarding, not a workspace", () => {
    assert.deepEqual(
      resolveAuthCallbackDestination({ type: "signup", next: null }),
      { path: "/onboarding", recovery: false },
    );
  });

  it("keeps invite next paths", () => {
    assert.deepEqual(
      resolveAuthCallbackDestination({ type: "invite", next: "/invite/tok_1" }),
      { path: "/invite/tok_1", recovery: false },
    );
  });
});

describe("authCallbackForwardSearch", () => {
  it("forwards a recovery code landed on the site root into the callback", () => {
    const params = new URLSearchParams("code=abc&type=recovery");
    assert.equal(
      authCallbackForwardSearch({ pathname: "/", searchParams: params }),
      "/auth/callback?code=abc&type=recovery&next=%2Freset-password",
    );
  });

  it("forwards a code that landed on login before the session is treated as signed-in", () => {
    const params = new URLSearchParams("code=abc&next=/reset-password");
    assert.equal(
      authCallbackForwardSearch({ pathname: "/login", searchParams: params }),
      "/auth/callback?code=abc&next=%2Freset-password",
    );
  });

  it("does not re-forward the callback itself", () => {
    const params = new URLSearchParams("code=abc&next=/reset-password");
    assert.equal(
      authCallbackForwardSearch({ pathname: "/auth/callback", searchParams: params }),
      null,
    );
  });
});
