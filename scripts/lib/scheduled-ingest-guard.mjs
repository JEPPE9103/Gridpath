/**
 * Guards the scheduled official-ingest worker.
 * Production ingest must run from GitHub Actions (or an explicit operator flag),
 * never from an unauthenticated web request.
 */
import { DESIGN_PARTNER_CLOUD_PROJECT_REF } from "./ingest-target.mjs";

export function scheduledIngestIsAllowed(env = process.env) {
  const inActions = env.GITHUB_ACTIONS === "true";
  const explicit = env.NOXHEIM_SCHEDULED_INGEST === "true";
  if (!inActions && !explicit) {
    return {
      ok: false,
      reason:
        "Scheduled official ingest refused: set GITHUB_ACTIONS or NOXHEIM_SCHEDULED_INGEST=true.",
    };
  }

  if (env.NOXHEIM_ALLOW_REMOTE_INGEST !== "true") {
    return {
      ok: false,
      reason: "Scheduled official ingest refused: NOXHEIM_ALLOW_REMOTE_INGEST must be true.",
    };
  }

  const expectedRef = (env.NOXHEIM_REMOTE_PROJECT_REF ?? "").trim();
  if (!expectedRef) {
    return {
      ok: false,
      reason: "Scheduled official ingest refused: NOXHEIM_REMOTE_PROJECT_REF is required.",
    };
  }
  if (expectedRef !== DESIGN_PARTNER_CLOUD_PROJECT_REF) {
    return {
      ok: false,
      reason: "Scheduled official ingest refused: project ref is not the allowlisted cloud.",
    };
  }

  return { ok: true, reason: null };
}

export function resolveScheduledTrigger(env = process.env, argv = process.argv) {
  const force =
    env.INGEST_FORCE === "true" || argv.includes("--force") || argv.includes("--manual");
  return force ? "manual" : "scheduled";
}
