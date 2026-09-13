import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { opportunityFunnelFromStatuses } from "@/lib/data/opportunity-funnel";

describe("opportunityFunnelFromStatuses", () => {
  it("counts searches and each opportunity status without needing geometry", () => {
    const funnel = opportunityFunnelFromStatuses(
      ["identified", "shortlisted", "rejected", "promoted", "identified"],
      3,
    );
    assert.equal(funnel.searches, 3);
    assert.equal(funnel.total, 5);
    assert.equal(funnel.identified, 2);
    assert.equal(funnel.shortlisted, 1);
    assert.equal(funnel.rejected, 1);
    assert.equal(funnel.promoted, 1);
    assert.equal(funnel.screening, 0);
  });
});
