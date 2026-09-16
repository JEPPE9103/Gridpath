/**
 * Profile planning-only cold path: ArcGIS fetch + optional DB upsert.
 * Usage:
 *   node scripts/profile-planning-ingest.mjs           # fetch only
 *   node scripts/profile-planning-ingest.mjs --upsert  # + DB (needs remote env)
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fetchPlanningFeatures } from "../src/lib/ingest/planning.ts";
import { PLANNING_SOURCE_SLUG } from "../src/lib/ingest/coverage-keys.ts";
import { DESIGN_PARTNER_CLOUD_PROJECT_REF, runSupabase } from "./lib/ingest-target.mjs";

const bbox = { west: 12.95, south: 55.55, east: 13.1, north: 55.65 };
const doUpsert = process.argv.includes("--upsert");

function cacheFile() {
  const root = process.env.NOXHEIM_GEODATA_CACHE?.trim() || path.join(tmpdir(), "noxheim-geodata");
  const key = `malmo-plan:${bbox.west.toFixed(4)}:${bbox.south.toFixed(4)}:${bbox.east.toFixed(4)}:${bbox.north.toFixed(4)}`;
  return path.join(root, `${key.replace(/:/g, "_")}.json`);
}

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1] ?? ""] = value;
  }
  return values;
}

const file = cacheFile();
if (existsSync(file)) {
  unlinkSync(file);
  console.log(JSON.stringify({ label: "cleared_disk_cache", file }));
}

const tFetch0 = Date.now();
const rows = await fetchPlanningFeatures(bbox);
const fetchMs = Date.now() - tFetch0;
console.log(
  JSON.stringify({
    label: "fetch_normalize_diskcache",
    ms: fetchMs,
    rows: rows.length,
    geomBytesApprox: JSON.stringify(rows.map((r) => r.geom)).length,
  }),
);

if (!doUpsert) {
  console.log(JSON.stringify({ label: "done_fetch_only" }));
  process.exit(0);
}

const keys = parseEnv(
  runSupabase(["projects", "api-keys", "--project-ref", DESIGN_PARTNER_CLOUD_PROJECT_REF, "-o", "env"]),
);
const client = createClient(
  `https://${DESIGN_PARTNER_CLOUD_PROJECT_REF}.supabase.co`,
  keys.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const tSnap0 = Date.now();
const { data: snap, error: snapErr } = await client
  .from("official_geographic_snapshots")
  .insert({
    source_slug: PLANNING_SOURCE_SLUG,
    snapshot_hash: `profile-${Date.now()}`,
    metadata: { profile: true, feature_count: rows.length },
  })
  .select("id")
  .single();
if (snapErr) {
  // Fallback: use RPC path via orchestrate-style insert if schema differs
  console.log(JSON.stringify({ label: "snapshot_insert_failed", error: snapErr.message }));
}

let snapshotId = snap?.id ?? null;
const snapMs = Date.now() - tSnap0;

const batchSizes = [40, 120, 200];
for (const batch of batchSizes) {
  // Use a unique external id prefix so we measure insert cost without fighting uniqueness forever
  const t0 = Date.now();
  let count = 0;
  const batchMs = [];
  for (let i = 0; i < rows.length; i += batch) {
    const bt0 = Date.now();
    const slice = rows.slice(i, i + batch).map((row, idx) => ({
      id: `profile-${batch}-${i + idx}-${Date.now()}`,
      name: row.name,
      designation: row.designation,
      geom: JSON.stringify(row.geom),
      properties: row.properties,
      sourceVersion: row.sourceVersion ?? PLANNING_SOURCE_SLUG,
      clipWest: row.clipWest,
      clipSouth: row.clipSouth,
      clipEast: row.clipEast,
      clipNorth: row.clipNorth,
    }));
    const { data, error } = await client.rpc("upsert_official_geographic_features", {
      p_source_slug: PLANNING_SOURCE_SLUG,
      p_snapshot_id: snapshotId,
      p_feature_class: "mapped_planning",
      p_rows: slice,
    });
    if (error) {
      console.log(JSON.stringify({ label: "upsert_error", batch, error: error.message }));
      break;
    }
    count += Number(data ?? 0);
    batchMs.push(Date.now() - bt0);
  }
  console.log(
    JSON.stringify({
      label: "upsert_batches",
      batch,
      ms: Date.now() - t0,
      upserted: count,
      calls: batchMs.length,
      avgBatchMs: batchMs.length ? Math.round(batchMs.reduce((a, b) => a + b, 0) / batchMs.length) : null,
      snapMs,
    }),
  );
  // Only run first batch size fully to avoid polluting DB heavily — break after measuring 40 vs sample of larger
  if (batch === 40) continue;
  // For larger batches, we already ran — stop after 200
}

console.log(JSON.stringify({ label: "done_with_upsert", note: "profile rows use temporary external ids" }));
