/**
 * Explicit Design Partner Cloud entrypoint for the sales-demo reset.
 * Sets required safety flags then runs the standard seed module.
 */
import { DESIGN_PARTNER_CLOUD_PROJECT_REF } from "./lib/ingest-target.mjs";

process.env.NOXHEIM_ALLOW_REMOTE_DEMO_SEED = "true";
process.env.NOXHEIM_REMOTE_PROJECT_REF = DESIGN_PARTNER_CLOUD_PROJECT_REF;

await import("./seed-sales-demo.mjs");
