/**
 * Safe integration harness for local/ephemeral Supabase only.
 *
 * Never points at Design Partner Cloud / production.
 * Requires Docker + `npx supabase start` (or an already-running local stack).
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTION_REF = "krgzpgqmnzljwlwptmcn";

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function skip(message) {
  console.log(message);
  process.exit(0);
}

function envLooksLikeProduction() {
  const blobs = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
    process.env.NOXHEIM_REMOTE_PROJECT_REF,
  ]
    .filter(Boolean)
    .join(" ");
  return blobs.includes(PRODUCTION_REF);
}

if (envLooksLikeProduction() && process.env.NOXHEIM_ALLOW_REMOTE_INGEST === "true") {
  fail(
    "test:integration refused: this command must not run against Design Partner Cloud / production.",
    1,
  );
}

const docker = spawnSync("docker", ["info"], { encoding: "utf8" });
if (docker.error || docker.status !== 0) {
  skip(
    "test:integration skipped: Docker is not available. Start Docker, run `npx supabase start`, then retry.",
  );
}

const status = spawnSync("npx", ["supabase", "status"], {
  cwd: repoRoot,
  encoding: "utf8",
  shell: true,
});
if (status.status !== 0) {
  skip(
    "test:integration skipped: local Supabase is not running. Run `npx supabase start` then retry.\n" +
      (status.stderr || status.stdout || ""),
  );
}

const smokeFile = path.join(repoRoot, "tests", "integration", "smoke.sql");
if (!existsSync(smokeFile)) {
  fail("Missing tests/integration/smoke.sql");
}

const query = spawnSync(
  "npx",
  ["supabase", "db", "query", "--local", "-f", smokeFile],
  { cwd: repoRoot, encoding: "utf8", shell: true },
);

if (query.status !== 0) {
  fail("test:integration failed:\n" + (query.stderr || query.stdout || "query failed"));
}

const output = `${query.stdout ?? ""}\n${query.stderr ?? ""}`;
if (/krgzpgqmnzljwlwptmcn/.test(output)) {
  fail("test:integration refused: unexpected production project ref in output.");
}

console.log(output.trim());
console.log("test:integration ok (local schema/RPC/PostGIS/storage contract)");
