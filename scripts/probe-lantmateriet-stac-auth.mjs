/**
 * Probe Lantmäteriet STAC-hojd auth. Prints AUTHENTICATED / FAILED only.
 * Never prints secrets, tokens, or response bodies with credentials.
 */
import { existsSync, readFileSync } from "node:fs";
import {
  LANTMATERIET_STAC_URL,
  lantmaterietAuthMode,
  lantmaterietCredentialsConfigured,
  resolveLantmaterietAuthHeaders,
} from "../src/lib/opportunities/lantmateriet.ts";

function loadEnvLocal() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    const key = match[1] ?? "";
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const mode = lantmaterietAuthMode();
  const configured = lantmaterietCredentialsConfigured();
  if (!configured) {
    console.log(JSON.stringify({ result: "FAILED", reason: "credentials_missing", mode }));
    process.exit(1);
  }
  try {
    const auth = await resolveLantmaterietAuthHeaders();
    if (!auth) {
      console.log(JSON.stringify({ result: "FAILED", reason: "auth_headers_null", mode }));
      process.exit(1);
    }
    const response = await fetch(`${LANTMATERIET_STAC_URL}/`, {
      headers: {
        authorization: auth.authorization,
        accept: "application/json",
        "user-agent": "NOXHEIM/1.0 (+https://www.noxheim.com; stac-hojd-probe)",
      },
    });
    if (response.ok) {
      console.log(JSON.stringify({ result: "AUTHENTICATED", httpStatus: response.status, mode }));
      process.exit(0);
    }
    console.log(
      JSON.stringify({
        result: "FAILED",
        reason: "stac_http_error",
        httpStatus: response.status,
        mode,
      }),
    );
    process.exit(1);
  } catch {
    console.log(JSON.stringify({ result: "FAILED", reason: "request_error", mode }));
    process.exit(1);
  }
}

main();
