import { DESIGN_PARTNER_CLOUD_PROJECT_REF } from "./lib/ingest-target.mjs";

process.env.NOXHEIM_ALLOW_REMOTE_INGEST = "true";
process.env.NOXHEIM_REMOTE_PROJECT_REF = DESIGN_PARTNER_CLOUD_PROJECT_REF;

await import("./ingest-scb-administrative-areas.mjs");
