import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { workspaceCookieSatisfiesMembershipLookup } from "@/lib/supabase/proxy-membership";

const ORG_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("workspaceCookieSatisfiesMembershipLookup", () => {
  it("skips the cookie-sync membership list on workspace routes with a valid cookie", () => {
    assert.equal(
      workspaceCookieSatisfiesMembershipLookup({
        pathnameIsWorkspace: true,
        cookieValue: ORG_ID,
      }),
      true,
    );
  });

  it("still looks up membership on login and when the cookie is missing or invalid", () => {
    assert.equal(
      workspaceCookieSatisfiesMembershipLookup({
        pathnameIsWorkspace: false,
        cookieValue: ORG_ID,
      }),
      false,
    );
    assert.equal(
      workspaceCookieSatisfiesMembershipLookup({
        pathnameIsWorkspace: true,
        cookieValue: null,
      }),
      false,
    );
    assert.equal(
      workspaceCookieSatisfiesMembershipLookup({
        pathnameIsWorkspace: true,
        cookieValue: "not-a-uuid",
      }),
      false,
    );
  });
});
