/**
 * Default production official-source ingest.
 *
 * GitHub Actions (or an explicit operator flag) runs the existing allowlisted
 * cloud ingest scripts: snapshot → normalize → versions → diff → impacts.
 *
 * Manual CLI (`npm run cloud:ingest-ei-nup`) remains a fallback, not the
 * normal operating model.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveIngestTarget } from "./lib/ingest-target.mjs";
import { scheduledIngestUsesCache } from "./lib/official-cache.mjs";
import { preferIpv4 } from "./lib/official-fetch.mjs";
import { resolveScheduledTrigger, scheduledIngestIsAllowed } from "./lib/scheduled-ingest-guard.mjs";

preferIpv4();

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const guard = scheduledIngestIsAllowed(process.env);
if (!guard.ok) {
  console.error(guard.reason);
  process.exit(1);
}

const trigger = resolveScheduledTrigger(process.env, process.argv);
process.env.NOXHEIM_ALLOW_REMOTE_INGEST = "true";
if (trigger === "scheduled") {
  process.env.MONITOR_TRIGGER = "scheduled";
} else {
  delete process.env.MONITOR_TRIGGER;
}

const target = resolveIngestTarget();
if (target.mode !== "remote") {
  console.error("Scheduled official ingest refused: expected remote Design Partner Cloud target.");
  process.exit(1);
}

console.log(
  JSON.stringify({
    event: "ingest.scheduled.start",
    trigger,
    projectRef: target.projectRef,
    officialArtifactTransport: scheduledIngestUsesCache()
      ? "noxheim_official_source_cache"
      : "direct_ei",
    sources: [
      "ei-network-development-plans",
      "ei-network-area-concessions",
      "nv-protected-areas",
      "nv-natura-2000",
    ],
  }),
);

function runCloudIngest(scriptName) {
  const result = spawnSync(process.execPath, [path.join(repoRoot, "scripts", scriptName)], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${scriptName} exited with ${result.status ?? "unknown"}`);
  }
}

try {
  runCloudIngest("cloud-ingest-ei-nup.mjs");
  runCloudIngest("cloud-ingest-ei-network-areas.mjs");
  runCloudIngest("cloud-ingest-naturvardsverket-protected.mjs");
  runCloudIngest("cloud-ingest-naturvardsverket-natura.mjs");
  console.log(JSON.stringify({ event: "ingest.scheduled.complete", trigger }));
} catch (error) {
  console.error(
    JSON.stringify({
      event: "ingest.scheduled.failed",
      message: error instanceof Error ? error.message : "failed",
    }),
  );
  process.exit(1);
}
