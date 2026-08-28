/**
 * Target resolution for the sales-demo seed/reset script.
 *
 * Default: local Supabase only, and only if the dedicated demo org exists.
 * Remote (Design Partner Cloud) requires ALL of:
 *   NOXHEIM_ALLOW_REMOTE_DEMO_SEED=true
 *   NOXHEIM_REMOTE_PROJECT_REF=<exact project ref>
 *
 * Never logs credentials.
 */
import {
  DESIGN_PARTNER_CLOUD_PROJECT_REF,
  queryIngestSql,
  runSupabase,
} from "./ingest-target.mjs";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function isLocalHostname(hostname) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function parseEnvOutput(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function linkedProjectRefSync() {
  const refFile = path.join(repoRoot, "supabase", ".temp", "project-ref");
  if (!existsSync(refFile)) {
    return null;
  }
  return readFileSync(refFile, "utf8").trim() || null;
}

export { DESIGN_PARTNER_CLOUD_PROJECT_REF, queryIngestSql, runSupabase };

/**
 * @returns {{ mode: 'local' | 'remote', url: string, projectRef: string | null, dbFlag: '--local' | '--linked' }}
 */
export function resolveDemoSeedTarget() {
  const allowRemote = process.env.NOXHEIM_ALLOW_REMOTE_DEMO_SEED === "true";
  const expectedRef = (process.env.NOXHEIM_REMOTE_PROJECT_REF || "").trim();
  const envUrl = process.env.SUPABASE_URL?.trim();

  if (!allowRemote) {
    let status = {};
    try {
      status = parseEnvOutput(runSupabase(["status", "-o", "env"]));
    } catch (error) {
      throw new Error(
        `Could not read local Supabase status. Start it with \`npx supabase start\`, or set NOXHEIM_ALLOW_REMOTE_DEMO_SEED=true for Design Partner Cloud.\n${error.message}`,
      );
    }
    const raw = envUrl || status.API_URL || "http://127.0.0.1:54321";
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      throw new Error(`Invalid Supabase URL: ${raw}`);
    }
    if (!isLocalHostname(parsed.hostname)) {
      throw new Error(
        `Refusing to run: default demo seed is local-only. URL must be localhost or 127.0.0.1, got ${parsed.hostname}. ` +
          `For Design Partner Cloud set NOXHEIM_ALLOW_REMOTE_DEMO_SEED=true and NOXHEIM_REMOTE_PROJECT_REF=${DESIGN_PARTNER_CLOUD_PROJECT_REF}.`,
      );
    }
    return {
      mode: "local",
      url: parsed.origin,
      projectRef: null,
      dbFlag: "--local",
    };
  }

  if (!expectedRef) {
    throw new Error(
      "Remote demo seed refused: set NOXHEIM_REMOTE_PROJECT_REF to the exact Design Partner Cloud project ref.",
    );
  }
  if (expectedRef !== DESIGN_PARTNER_CLOUD_PROJECT_REF) {
    throw new Error(
      `Remote demo seed refused: NOXHEIM_REMOTE_PROJECT_REF=${expectedRef} is not the allowlisted Design Partner Cloud ref (${DESIGN_PARTNER_CLOUD_PROJECT_REF}).`,
    );
  }

  const linkedRef = linkedProjectRefSync();
  if (linkedRef && linkedRef !== expectedRef) {
    throw new Error(
      `Remote demo seed refused: CLI linked project (${linkedRef}) does not match NOXHEIM_REMOTE_PROJECT_REF (${expectedRef}).`,
    );
  }

  const cloudHost = `${expectedRef}.supabase.co`;
  let url = `https://${cloudHost}`;
  if (envUrl) {
    let parsed;
    try {
      parsed = new URL(envUrl);
    } catch {
      throw new Error(`Invalid SUPABASE_URL: ${envUrl}`);
    }
    if (parsed.hostname !== cloudHost) {
      throw new Error(
        `Remote demo seed refused: SUPABASE_URL host ${parsed.hostname} does not match allowlisted ${cloudHost}.`,
      );
    }
    url = parsed.origin;
  }

  console.log(
    `[demo-seed-target] REMOTE mode enabled for allowlisted project ref ${expectedRef} (${cloudHost})`,
  );

  return {
    mode: "remote",
    url,
    projectRef: expectedRef,
    dbFlag: "--linked",
  };
}

export function runDemoSeedSql(target, filePath) {
  const raw = runSupabase([
    "--output-format",
    "json",
    "db",
    "query",
    target.dbFlag,
    "-f",
    filePath,
  ]);
  return raw;
}
