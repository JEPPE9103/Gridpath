import { scheduledIngestIsAllowed, resolveScheduledTrigger } from "./scheduled-ingest-guard.mjs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("scheduled ingest guard", () => {
  it("refuses unless GitHub Actions or the explicit operator flag is set", () => {
    const result = scheduledIngestIsAllowed({
      NOXHEIM_ALLOW_REMOTE_INGEST: "true",
      NOXHEIM_REMOTE_PROJECT_REF: "krgzpgqmnzljwlwptmcn",
    });
    assert.equal(result.ok, false);
  });

  it("refuses a non-allowlisted project ref", () => {
    const result = scheduledIngestIsAllowed({
      GITHUB_ACTIONS: "true",
      NOXHEIM_ALLOW_REMOTE_INGEST: "true",
      NOXHEIM_REMOTE_PROJECT_REF: "not-the-cloud",
    });
    assert.equal(result.ok, false);
  });

  it("allows the Design Partner Cloud from GitHub Actions", () => {
    const result = scheduledIngestIsAllowed({
      GITHUB_ACTIONS: "true",
      NOXHEIM_ALLOW_REMOTE_INGEST: "true",
      NOXHEIM_REMOTE_PROJECT_REF: "krgzpgqmnzljwlwptmcn",
    });
    assert.equal(result.ok, true);
  });

  it("uses manual trigger only when force is requested", () => {
    assert.equal(resolveScheduledTrigger({ INGEST_FORCE: "true" }, []), "manual");
    assert.equal(resolveScheduledTrigger({}, ["node", "script", "--force"]), "manual");
    assert.equal(resolveScheduledTrigger({}, []), "scheduled");
  });
});
