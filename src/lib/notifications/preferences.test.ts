import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { weeklyDigestText } from "@/lib/notifications/copy";

describe("notification preference copy", () => {
  it("does not treat digest attention as the Overview workflow-attention KPI", () => {
    const text = weeklyDigestText(
      {
        organizationName: "Org A",
        periodKey: "digest:2026-W36",
        activeProjectCount: 4,
        attentionProjectCount: 1,
        newImpactCount: 2,
        overdueRequiredCount: 1,
        approachingDeadlineCount: 0,
        addedProjectCount: 0,
        archivedProjectCount: 0,
      },
      "https://www.noxheim.com",
    );
    assert.match(text, /open warning\/critical alerts or overdue required items/);
    assert.match(text, /not the same as Overview/);
  });
});
