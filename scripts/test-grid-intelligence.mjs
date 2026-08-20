/**
 * Local Grid Intelligence engine test.
 * Inserts a fictional NOXHEIM fixture (NOT real operator data), then
 * runs PostGIS geographic matching → change_impacts → alerts.
 *
 * Refuses cloud URLs. Idempotent: re-running reuses fixture rows
 * and does not create uncontrolled duplicates.
 *
 * Distinct from official Ei lokalnät ingest (`ei-network-area-concessions`):
 * this source is authority_level=noxheim and must never be treated as regulator data.
 *
 * Usage (after `npx supabase db reset` and `npm run dev:bootstrap-auth`):
 *   node scripts/test-grid-intelligence.mjs
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_SLUG = "noxheim-local-grid-intelligence-fixture";
const SOURCE_NAME = "NOXHEIM Local Grid Intelligence Fixture";
const AREA_EXTERNAL_ID = "noxheim-local-fixture-gavle-falun";
const CHANGE_FIXTURE_KEY = "noxheim-local-fixture-change-1";
const FIXTURE_LABEL = "LOCAL DEVELOPMENT FIXTURE — NOT REAL GRID DATA";

// Rectangle covering seeded Gävle (17.1413, 60.6749) and Falun (15.6355, 60.6065).
// Other seeded sites (Uppsala, Västerås, Sundsvall, …) sit outside this box.
const AREA_WKT =
  "MULTIPOLYGON(((15.50 60.50, 17.40 60.50, 17.40 60.80, 15.50 60.80, 15.50 60.50)))";

const GEOGRAPHIC_REASON =
  "Project site's primary coordinate intersects the geographic area associated with this source change.";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supabaseCli = path.join(repoRoot, "node_modules", "supabase", "dist", "supabase.js");

function isLocalHostname(hostname) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function assertLocalUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid Supabase URL: ${rawUrl}`);
  }
  if (!isLocalHostname(parsed.hostname)) {
    throw new Error(
      `Refusing to run: this script is local-only. URL must be localhost or 127.0.0.1, got ${parsed.hostname}.`,
    );
  }
  return parsed.origin;
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

function runSupabase(args) {
  if (!existsSync(supabaseCli)) {
    throw new Error("Local supabase CLI is missing. Run npm install first.");
  }
  try {
    return execFileSync(process.execPath, [supabaseCli, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const detail = [error.stderr, error.stdout, error.message]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join("\n");
    throw new Error(detail || "supabase CLI command failed");
  }
}

function loadLocalConfig() {
  let status = {};
  try {
    status = parseEnvOutput(runSupabase(["status", "-o", "env"]));
  } catch (error) {
    throw new Error(
      `Could not read local Supabase status. Start it with \`npx supabase start\`.\n${error.message}`,
    );
  }
  const envUrl = process.env.SUPABASE_URL?.trim();
  const url = assertLocalUrl(envUrl || status.API_URL || "http://127.0.0.1:54321");
  if (envUrl) {
    assertLocalUrl(envUrl);
  }
  return { url };
}

function quoteSql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function queryLocal(sql) {
  const dir = mkdtempSync(path.join(tmpdir(), "noxheim-grid-intel-"));
  const file = path.join(dir, "query.sql");
  writeFileSync(file, sql, "utf8");
  try {
    const raw = runSupabase([
      "--output-format",
      "json",
      "db",
      "query",
      "--local",
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

function contentHash(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function requireRow(rows, label) {
  const row = rows[0];
  if (!row) {
    throw new Error(`Expected a row for ${label}.`);
  }
  return row;
}

function main() {
  const { url } = loadLocalConfig();
  console.log(`Grid Intelligence fixture against ${url}`);
  console.log(FIXTURE_LABEL);
  console.log(`Fixture polygon (WGS84): ${AREA_WKT}`);

  const snapshotA = {
    label: FIXTURE_LABEL,
    revision: 1,
    signal: "baseline planning note",
  };
  const snapshotB = {
    label: FIXTURE_LABEL,
    revision: 2,
    signal: "updated planning note",
  };
  const hashA = contentHash(snapshotA);
  const hashB = contentHash(snapshotB);

  queryLocal(`
insert into public.grid_sources (
  name, slug, source_type, publisher, country_code, active, authority_level, update_frequency
) values (
  ${quoteSql(SOURCE_NAME)},
  ${quoteSql(SOURCE_SLUG)},
  'manual',
  'NOXHEIM local development',
  'SE',
  true,
  'noxheim',
  'manual'
)
on conflict (slug) do update
set
  name = excluded.name,
  source_type = excluded.source_type,
  publisher = excluded.publisher,
  authority_level = excluded.authority_level,
  active = true;
`);

  const source = requireRow(
    queryLocal(`
select id, name, slug, source_type, authority_level, publisher
from public.grid_sources
where slug = ${quoteSql(SOURCE_SLUG)};
`),
    "grid_sources",
  );

  queryLocal(`
insert into public.grid_areas (
  source_id, external_id, name, area_type, country_code, region, geometry,
  published_at, retrieved_at, confidence, metadata
)
select
  ${quoteSql(source.id)}::uuid,
  ${quoteSql(AREA_EXTERNAL_ID)},
  ${quoteSql("LOCAL DEVELOPMENT FIXTURE — Gävle–Falun corridor (not real grid data)")},
  'planning_area',
  'SE',
  'Gävleborg / Dalarna',
  extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromtext(${quoteSql(AREA_WKT)}), 4326)),
  timestamptz '2026-08-01 08:00:00+02',
  timestamptz '2026-08-20 12:00:00+02',
  'low',
  jsonb_build_object(
    'fixture', true,
    'label', ${quoteSql(FIXTURE_LABEL)},
    'wkt', ${quoteSql(AREA_WKT)},
    'match_method', 'PostGIS ST_Intersects(grid_areas.geometry, project_sites.geom)'
  )
on conflict (source_id, external_id) where external_id is not null
do update set
  name = excluded.name,
  geometry = excluded.geometry,
  metadata = excluded.metadata,
  retrieved_at = excluded.retrieved_at;
`);

  const area = requireRow(
    queryLocal(`
select id, name, external_id, extensions.st_astext(geometry) as wkt
from public.grid_areas
where source_id = ${quoteSql(source.id)}::uuid
  and external_id = ${quoteSql(AREA_EXTERNAL_ID)};
`),
    "grid_areas",
  );

  queryLocal(`
insert into public.source_snapshots (
  source_id, retrieved_at, published_at, content_hash, raw_content, status, metadata
) values
(
  ${quoteSql(source.id)}::uuid,
  timestamptz '2026-08-01 08:00:00+02',
  timestamptz '2026-08-01 08:00:00+02',
  ${quoteSql(hashA)},
  ${quoteSql(JSON.stringify(snapshotA))}::jsonb,
  'success',
  jsonb_build_object('fixture', true, 'label', ${quoteSql(FIXTURE_LABEL)}, 'revision', 1)
),
(
  ${quoteSql(source.id)}::uuid,
  timestamptz '2026-08-20 12:00:00+02',
  timestamptz '2026-08-18 09:00:00+02',
  ${quoteSql(hashB)},
  ${quoteSql(JSON.stringify(snapshotB))}::jsonb,
  'success',
  jsonb_build_object('fixture', true, 'label', ${quoteSql(FIXTURE_LABEL)}, 'revision', 2)
)
on conflict (source_id, content_hash) do update
set metadata = excluded.metadata;
`);

  const snapshots = queryLocal(`
select id, content_hash, retrieved_at, metadata
from public.source_snapshots
where source_id = ${quoteSql(source.id)}::uuid
order by retrieved_at;
`);
  const snapA = snapshots.find((row) => row.content_hash === hashA);
  const snapB = snapshots.find((row) => row.content_hash === hashB);
  if (!snapA || !snapB) {
    throw new Error("Expected snapshot A and snapshot B.");
  }

  queryLocal(`
insert into public.grid_observations (
  source_id, grid_area_id, observation_type, value_text, direction,
  published_at, retrieved_at, confidence, authority_level, source_url, raw_metadata
)
select
  ${quoteSql(source.id)}::uuid,
  ${quoteSql(area.id)}::uuid,
  'process',
  'Fictional local planning note updated. Not a capacity statement.',
  'not_applicable',
  timestamptz '2026-08-18 09:00:00+02',
  timestamptz '2026-08-20 12:00:00+02',
  'low',
  'noxheim',
  null,
  jsonb_build_object('fixture', true, 'label', ${quoteSql(FIXTURE_LABEL)})
where not exists (
  select 1
  from public.grid_observations as existing
  where existing.source_id = ${quoteSql(source.id)}::uuid
    and existing.raw_metadata ->> 'fixture' = 'true'
    and existing.observation_type = 'process'
);
`);

  queryLocal(`
insert into public.external_changes (
  source_id, previous_snapshot_id, current_snapshot_id, change_type, title, summary,
  severity, grid_area_id, detected_at, published_at, confidence, before_value, after_value, metadata
)
select
  ${quoteSql(source.id)}::uuid,
  ${quoteSql(snapA.id)}::uuid,
  ${quoteSql(snapB.id)}::uuid,
  'process',
  'Local development fixture changed',
  ${quoteSql(`${FIXTURE_LABEL}. Fictional planning metadata updated between snapshot A and snapshot B.`)},
  'info',
  ${quoteSql(area.id)}::uuid,
  timestamptz '2026-08-20 12:05:00+02',
  timestamptz '2026-08-18 09:00:00+02',
  'low',
  ${quoteSql(JSON.stringify(snapshotA))}::jsonb,
  ${quoteSql(JSON.stringify(snapshotB))}::jsonb,
  jsonb_build_object(
    'fixture', true,
    'fixture_key', ${quoteSql(CHANGE_FIXTURE_KEY)},
    'label', ${quoteSql(FIXTURE_LABEL)}
  )
where not exists (
  select 1
  from public.external_changes as existing
  where existing.metadata ->> 'fixture_key' = ${quoteSql(CHANGE_FIXTURE_KEY)}
);
`);

  const change = requireRow(
    queryLocal(`
select id, title, severity, source_id, grid_area_id, summary
from public.external_changes
where metadata ->> 'fixture_key' = ${quoteSql(CHANGE_FIXTURE_KEY)};
`),
    "external_changes",
  );

  const impacts = queryLocal(`
select change_impact_id, project_id, organization_id, inserted
from private.apply_geographic_change_impacts(${quoteSql(change.id)}::uuid);
`);

  const alerts = queryLocal(`
select alert_id, change_impact_id, project_id, inserted
from private.create_alerts_from_change_impacts(${quoteSql(change.id)}::uuid);
`);

  const matchEvidence = queryLocal(`
select
  p.name,
  p.slug,
  o.name as organization_name,
  o.id as organization_id,
  round(extensions.st_x(ps.geom)::numeric, 4) as longitude,
  round(extensions.st_y(ps.geom)::numeric, 4) as latitude,
  extensions.st_intersects(ga.geometry, ps.geom) as intersects
from public.projects as p
inner join public.organizations as o on o.id = p.organization_id
inner join public.project_sites as ps on ps.project_id = p.id and ps.is_primary
cross join public.grid_areas as ga
where ga.id = ${quoteSql(area.id)}::uuid
order by intersects desc, p.name;
`);

  const impactDetails = queryLocal(`
select
  ci.id as change_impact_id,
  p.name as project_name,
  p.slug,
  o.name as organization_name,
  ci.match_type,
  ci.impact_level,
  ci.reason,
  ci.confidence
from public.change_impacts as ci
inner join public.projects as p on p.id = ci.project_id
inner join public.organizations as o on o.id = ci.organization_id
where ci.external_change_id = ${quoteSql(change.id)}::uuid
order by p.name;
`);

  const alertDetails = queryLocal(`
select a.id as alert_id, a.title, a.severity, a.metadata, p.name as project_name
from public.alerts as a
left join public.projects as p on p.id = a.project_id
where a.metadata ->> 'external_change_id' = ${quoteSql(change.id)}
order by p.name;
`);

  const matched = matchEvidence.filter((row) => row.intersects === true || row.intersects === "t");
  const unmatched = matchEvidence.filter((row) => row.intersects !== true && row.intersects !== "t");

  const impactCount = queryLocal(`
select count(*)::int as count
from public.change_impacts
where external_change_id = ${quoteSql(change.id)}::uuid;
`);
  const alertCount = queryLocal(`
select count(*)::int as count
from public.alerts
where metadata ->> 'external_change_id' = ${quoteSql(change.id)};
`);

  console.log("\n--- Source ---");
  console.log(`  ${source.name} (${source.slug})`);
  console.log(`  type=${source.source_type} authority=${source.authority_level}`);
  console.log(`  publisher=${source.publisher}`);
  console.log(`  id=${source.id}`);

  console.log("\n--- Change ---");
  console.log(`  ${change.title}`);
  console.log(`  id=${change.id}`);
  console.log(`  severity=${change.severity} (NOXHEIM operational classification)`);
  console.log(`  ${change.summary}`);

  console.log("\n--- PostGIS intersection evidence ---");
  for (const row of matchEvidence) {
    const flag = row.intersects === true || row.intersects === "t" ? "MATCH" : "no";
    console.log(
      `  [${flag}] ${row.name} (${row.slug}) lng=${row.longitude} lat=${row.latitude}`,
    );
  }

  console.log("\n--- Matched projects ---");
  if (matched.length === 0) {
    console.log("  (none)");
  } else {
    for (const row of matched) {
      console.log(`  ${row.name} · ${row.organization_name}`);
    }
  }

  console.log("\n--- Not matched ---");
  for (const row of unmatched) {
    console.log(`  ${row.name}`);
  }

  console.log("\n--- Change impacts ---");
  console.log(`  apply() returned ${impacts.length} row(s); inserted this run: ${impacts.filter((row) => row.inserted === true || row.inserted === "t").length}`);
  console.log(`  stored change_impacts: ${impactCount[0]?.count ?? 0}`);
  for (const row of impactDetails) {
    console.log(`  ${row.project_name} [${row.change_impact_id}]`);
    console.log(`    org=${row.organization_name}`);
    console.log(`    match=${row.match_type} level=${row.impact_level} confidence=${row.confidence}`);
    console.log(`    reason=${row.reason}`);
  }

  const unexpectedReason = impactDetails.find((row) => row.reason !== GEOGRAPHIC_REASON);
  if (unexpectedReason) {
    throw new Error("Impact reason did not match the geographic matching statement.");
  }

  console.log("\n--- Alerts ---");
  console.log(`  create_alerts() returned ${alerts.length} row(s); inserted this run: ${alerts.filter((row) => row.inserted === true || row.inserted === "t").length}`);
  console.log(`  stored alerts: ${alertCount[0]?.count ?? 0}`);
  for (const row of alertDetails) {
    console.log(`  ${row.alert_id} · ${row.title}`);
  }

  if (impactDetails.length !== matched.length) {
    throw new Error(
      `Expected ${matched.length} change_impacts for PostGIS matches, found ${impactDetails.length}.`,
    );
  }
  if (alertDetails.length !== impactDetails.length) {
    throw new Error(
      `Expected one alert per change_impact (${impactDetails.length}), found ${alertDetails.length}.`,
    );
  }

  console.log("\nIdempotent geographic matching succeeded. No hardcoded project IDs were used.");
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
