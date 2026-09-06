import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security/headers";

describe("security headers", () => {
  it("includes CSP compatible with Supabase, MapLibre tiles, and Next assets", () => {
    const csp = contentSecurityPolicy();
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /https:\/\/\*\.supabase\.co/);
    assert.match(csp, /wss:\/\/\*\.supabase\.co/);
    assert.match(csp, /tiles\.openfreemap\.org/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(csp.includes("api.resend.com"), false);
  });

  it("sets nosniff, referrer, frame, and permissions policies", () => {
    const keys = securityHeaders().map((header) => header.key);
    assert.deepEqual(
      keys.includes("X-Content-Type-Options") &&
        keys.includes("Referrer-Policy") &&
        keys.includes("Permissions-Policy") &&
        keys.includes("X-Frame-Options"),
      true,
    );
  });
});
