import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canCreateOrEditProjects } from "@/lib/projects/authorization";

describe("viewer authorization in active workspace", () => {
  it("blocks project mutations for viewer role", () => {
    assert.equal(canCreateOrEditProjects("viewer"), false);
  });

  it("allows project mutations for member role", () => {
    assert.equal(canCreateOrEditProjects("member"), true);
  });

  it("allows project mutations for admin role", () => {
    assert.equal(canCreateOrEditProjects("admin"), true);
  });
});
