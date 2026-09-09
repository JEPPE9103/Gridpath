import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOpportunityForm } from "./validation";

describe("opportunity form validation", () => {
  it("persists screening criteria fields from the form", () => {
    const form = new FormData();
    form.set("name", "Örebro South");
    form.set("technology", "battery_storage");
    form.set("country", "SE");
    form.set("region", "Örebro");
    form.set("municipality", "Örebro");
    form.set("latitude", "59.27");
    form.set("longitude", "15.21");
    form.set("targetMw", "40");
    form.set("targetMwh", "80");
    form.set("minSiteAreaHa", "2");
    form.set("excludeProtected", "on");
    form.set("notes", "Screen SE3 BESS");
    const result = parseOpportunityForm(form);
    assert.ok(result.parsed);
    assert.equal(result.parsed?.name, "Örebro South");
    assert.equal(result.parsed?.excludeProtected, true);
    assert.equal(result.parsed?.minSiteAreaHa, 2);
    assert.equal(result.parsed?.notes, "Screen SE3 BESS");
  });

  it("rejects invalid coordinates without inventing a site", () => {
    const form = new FormData();
    form.set("name", "Bad coords");
    form.set("technology", "solar");
    form.set("latitude", "99");
    form.set("longitude", "15");
    const result = parseOpportunityForm(form);
    assert.equal(result.parsed, null);
    assert.ok(result.fieldErrors.latitude);
  });
});
