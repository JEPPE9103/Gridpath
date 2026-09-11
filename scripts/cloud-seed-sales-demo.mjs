/**
 * Explicit Design Partner Cloud entrypoint for the sales-demo reset.
 * Sets required remote safety flags then runs the standard seed module.
 *
 * Destructive remote reset also requires:
 *   NOXHEIM_CONFIRM_DEMO_RESET=noxheim-demo-development
 *
 * Non-destructive:
 *   npm run demo:plan
 *   npm run demo:preflight
 *
 * Do not use this wrapper unless you intend to target Design Partner Cloud.
 */
import { DESIGN_PARTNER_CLOUD_PROJECT_REF } from "./lib/ingest-target.mjs";

process.env.NOXHEIM_ALLOW_REMOTE_DEMO_SEED = "true";
process.env.NOXHEIM_REMOTE_PROJECT_REF = DESIGN_PARTNER_CLOUD_PROJECT_REF;

await import("./seed-sales-demo.mjs");
