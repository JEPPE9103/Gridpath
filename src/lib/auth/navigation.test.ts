import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAuthNavigation } from "@/lib/auth/navigation";

describe("resolveAuthNavigation", () => {
  it("keeps a recovery session on /reset-password", () => {
    assert.deepEqual(
      resolveAuthNavigation({
        pathname: "/reset-password",
        hasUser: true,
        hasOrganization: true,
        isRecovery: true,
      }),
      { type: "allow" },
    );
  });

  it("does not send recovery into a workspace or demo fallback", () => {
    assert.deepEqual(
      resolveAuthNavigation({
        pathname: "/portfolio",
        hasUser: true,
        hasOrganization: true,
        isRecovery: true,
      }),
      { type: "redirect", pathname: "/reset-password" },
    );
    assert.deepEqual(
      resolveAuthNavigation({
        pathname: "/login",
        hasUser: true,
        hasOrganization: true,
        isRecovery: true,
      }),
      { type: "redirect", pathname: "/reset-password" },
    );
    assert.deepEqual(
      resolveAuthNavigation({
        pathname: "/onboarding",
        hasUser: true,
        hasOrganization: false,
        isRecovery: true,
      }),
      { type: "redirect", pathname: "/reset-password" },
    );
  });

  it("sends unauthenticated users from protected routes to login", () => {
    assert.deepEqual(
      resolveAuthNavigation({
        pathname: "/overview",
        hasUser: false,
        hasOrganization: false,
        isRecovery: false,
      }),
      { type: "redirect", pathname: "/login" },
    );
  });

  it("sends an authenticated login visit to the user's workspace or onboarding", () => {
    assert.deepEqual(
      resolveAuthNavigation({
        pathname: "/login",
        hasUser: true,
        hasOrganization: true,
        isRecovery: false,
      }),
      { type: "redirect", pathname: "/overview" },
    );
    assert.deepEqual(
      resolveAuthNavigation({
        pathname: "/login",
        hasUser: true,
        hasOrganization: false,
        isRecovery: false,
      }),
      { type: "redirect", pathname: "/onboarding" },
    );
  });

  it("sends zero-organisation users away from the product into onboarding", () => {
    assert.deepEqual(
      resolveAuthNavigation({
        pathname: "/map",
        hasUser: true,
        hasOrganization: false,
        isRecovery: false,
      }),
      { type: "redirect", pathname: "/onboarding" },
    );
  });

  it("lets a stale recovery cookie without a session reach forgot-password", () => {
    assert.deepEqual(
      resolveAuthNavigation({
        pathname: "/forgot-password",
        hasUser: false,
        hasOrganization: false,
        isRecovery: true,
      }),
      { type: "allow" },
    );
    assert.deepEqual(
      resolveAuthNavigation({
        pathname: "/login",
        hasUser: false,
        hasOrganization: false,
        isRecovery: true,
      }),
      { type: "allow" },
    );
  });

  it("does not loop callback or invite through login", () => {
    assert.deepEqual(
      resolveAuthNavigation({
        pathname: "/auth/callback",
        hasUser: false,
        hasOrganization: false,
        isRecovery: false,
      }),
      { type: "allow" },
    );
    assert.deepEqual(
      resolveAuthNavigation({
        pathname: "/invite/abc",
        hasUser: false,
        hasOrganization: false,
        isRecovery: false,
      }),
      { type: "allow" },
    );
  });
});
