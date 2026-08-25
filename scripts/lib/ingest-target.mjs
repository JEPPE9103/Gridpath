/**
 * Shared target resolution for official Ei ingest scripts.
 *
 * Default: local Supabase only.
 * Remote (Design Partner Cloud) requires ALL of:
 *   NOXHEIM_ALLOW_REMOTE_INGEST=true
 *   NOXHEIM_REMOTE_PROJECT_REF=<exact project ref>
 *   optional SUPABASE_URL whose host must match that ref
 *
 * Never logs credentials.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const supabaseCli = path.join(repoRoot, "node_modules", "supabase", "dist", "supabase.js");

/** Canonical Design Partner Cloud project — must match Vercel/linked cloud. */
export const DESIGN_PARTNER_CLOUD_PROJECT_REF = "krgzpgqmnzljwlwptmcn";

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

export function runSupabase(args) {
  if (!existsSync(supabaseCli)) {
    throw new Error("Local supabase CLI is missing. Run npm install first.");
  }
  try {
    return execFileSync(process.execPath, [supabaseCli, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    const detail = [error.stderr, error.stdout, error.message]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join("\n");
    throw new Error(detail || "supabase CLI command failed");
  }
}

function linkedProjectRefSync() {
  const refFile = path.join(repoRoot, "supabase", ".temp", "project-ref");
  if (!existsSync(refFile)) {
    return null;
  }
  return readFileSync(refFile, "utf8").trim() || null;
}

/**
 * @returns {{ mode: 'local' | 'remote', url: string, projectRef: string | null, dbFlag: '--local' | '--linked' }}
 */
export function resolveIngestTarget() {
  const allowRemote = process.env.NOXHEIM_ALLOW_REMOTE_INGEST === "true";
  const expectedRef = (process.env.NOXHEIM_REMOTE_PROJECT_REF || "").trim();
  const envUrl = process.env.SUPABASE_URL?.trim();

  if (!allowRemote) {
    let status = {};
    try {
      status = parseEnvOutput(runSupabase(["status", "-o", "env"]));
    } catch (error) {
      throw new Error(
        `Could not read local Supabase status. Start it with \`npx supabase start\`.\n${error.message}`,
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
        `Refusing to run: default ingest is local-only. URL must be localhost or 127.0.0.1, got ${parsed.hostname}. ` +
          `For Design Partner Cloud set NOXHEIM_ALLOW_REMOTE_INGEST=true and NOXHEIM_REMOTE_PROJECT_REF=${DESIGN_PARTNER_CLOUD_PROJECT_REF}.`,
      );
    }
    if (envUrl) {
      const envParsed = new URL(envUrl);
      if (!isLocalHostname(envParsed.hostname)) {
        throw new Error(
          `Refusing to run: SUPABASE_URL is not local (${envParsed.hostname}).`,
        );
      }
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
      "Remote ingest refused: set NOXHEIM_REMOTE_PROJECT_REF to the exact Design Partner Cloud project ref.",
    );
  }
  if (expectedRef !== DESIGN_PARTNER_CLOUD_PROJECT_REF) {
    throw new Error(
      `Remote ingest refused: NOXHEIM_REMOTE_PROJECT_REF=${expectedRef} is not the allowlisted Design Partner Cloud ref (${DESIGN_PARTNER_CLOUD_PROJECT_REF}).`,
    );
  }

  const linkedRef = linkedProjectRefSync();
  if (linkedRef && linkedRef !== expectedRef) {
    throw new Error(
      `Remote ingest refused: CLI linked project (${linkedRef}) does not match NOXHEIM_REMOTE_PROJECT_REF (${expectedRef}).`,
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
        `Remote ingest refused: SUPABASE_URL host ${parsed.hostname} does not match allowlisted ${cloudHost}.`,
      );
    }
    url = parsed.origin;
  }

  console.log(
    `[ingest-target] REMOTE mode enabled for allowlisted project ref ${expectedRef} (${cloudHost})`,
  );

  return {
    mode: "remote",
    url,
    projectRef: expectedRef,
    dbFlag: "--linked",
  };
}

export function queryIngestSql(target, sql) {
  const dir = mkdtempSync(path.join(tmpdir(), "noxheim-ei-ingest-"));
  const file = path.join(dir, "query.sql");
  writeFileSync(file, sql, "utf8");
  try {
    const raw = runSupabase([
      "--output-format",
      "json",
      "db",
      "query",
      target.dbFlag,
      "-f",
      file,
    ]);
    const jsonStart = raw.indexOf("{");
    if (jsonStart === -1) {
      return [];
    }
    const parsed = JSON.parse(raw.slice(jsonStart));
    return parsed.rows ?? [];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
