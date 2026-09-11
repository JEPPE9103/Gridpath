import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DESIGN_PARTNER_CLOUD_PROJECT_REF } from "./ingest-target.mjs";
import { resolveDemoSeedTarget } from "./demo-seed-target.mjs";

describe("demo seed target guardrails", () => {
  it("refuses a non-allowlisted remote project ref", () => {
    const previousAllow = process.env.NOXHEIM_ALLOW_REMOTE_DEMO_SEED;
    const previousRef = process.env.NOXHEIM_REMOTE_PROJECT_REF;
    process.env.NOXHEIM_ALLOW_REMOTE_DEMO_SEED = "true";
    process.env.NOXHEIM_REMOTE_PROJECT_REF = "not-the-cloud";
    try {
      assert.throws(() => resolveDemoSeedTarget(), /not the allowlisted Design Partner Cloud ref/);
    } finally {
      if (previousAllow == null) delete process.env.NOXHEIM_ALLOW_REMOTE_DEMO_SEED;
      else process.env.NOXHEIM_ALLOW_REMOTE_DEMO_SEED = previousAllow;
      if (previousRef == null) delete process.env.NOXHEIM_REMOTE_PROJECT_REF;
      else process.env.NOXHEIM_REMOTE_PROJECT_REF = previousRef;
    }
  });

  it("keeps the Design Partner Cloud ref as the only remote target", () => {
    assert.equal(DESIGN_PARTNER_CLOUD_PROJECT_REF, "krgzpgqmnzljwlwptmcn");
  });
});
