/**
 * Local NUP observation-diff fixture.
 *
 * Creates a SEPARATE source (not ei-network-development-plans) with two
 * snapshots, immutable observation versions, then runs the generic
 * observation-diff engine → external_changes → PostGIS change_impacts.
 *
 * Does NOT create customer alerts.
 * Does NOT insert fake snapshots under the official Ei NUP source.
 * Values are DEVELOPMENT FIXTURE values only.
 *
 * Usage (localhost Supabase):
 *   npm run dev:test-nup-change-detection
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_SLUG = "noxheim-local-nup-change-fixture";
const SOURCE_NAME = "NOXHEIM Local NUP Change Fixture";
const AREA_EXTERNAL_ID = "noxheim-local-nup-fixture-gavle";
const FIXTURE_LABEL = "LOCAL DEVELOPMENT FIXTURE — NOT REAL EI DATA";
const OFFICIAL_NUP_SLUG = "ei-network-development-plans";

// Small WGS84 box covering seeded Gävle BESS (17.1413, 60.6749) only.
const AREA_WKT =
  "MULTIPOLYGON(((17.12 60.66, 17.17 60.66, 17.17 60.69, 17.12 60.69, 17.12 60.66)))";

const IMPACT_REASON =
  "Project site's primary coordinate intersects the NUP planning area associated with this published change.";

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

function sqlJson(value) {
  return `${quoteSql(JSON.stringify(value))}::jsonb`;
}

function queryLocal(sql) {
  const dir = mkdtempSync(path.join(tmpdir(), "noxheim-nup-diff-"));
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

function asBool(value) {
  return value === true || value === "t";
}

function projectFingerprintSql() {
  return `
select
  count(*)::int as project_count,
  md5(string_agg(
    p.id::text || '|' ||
    coalesce(p.grid_operator_id::text, '') || '|' ||
    coalesce(p.connection_outlook, '') || '|' ||
    coalesce(p.confidence, '') || '|' ||
    coalesce(p.connection_stage, '') || '|' ||
    coalesce(p.import_mw::text, '') || '|' ||
    coalesce(p.export_mw::text, ''),
    ',' order by p.id
  )) as fingerprint
from public.projects as p;
`;
}

function officialSafetySql() {
  return `
select
  (
    select count(*)::int
    from public.source_snapshots as ss
    inner join public.grid_sources as gs on gs.id = ss.source_id
    where gs.slug = ${quoteSql(OFFICIAL_NUP_SLUG)}
      and ss.status in ('success', 'unchanged')
  ) as official_snapshots,
  (
    select count(*)::int
    from public.grid_observation_versions as gov
    inner join public.source_snapshots as ss on ss.id = gov.source_snapshot_id
    inner join public.grid_sources as gs on gs.id = ss.source_id
    where gs.slug = ${quoteSql(OFFICIAL_NUP_SLUG)}
  ) as official_versions,
  (
    select count(*)::int
    from public.external_changes as ec
    inner join public.grid_sources as gs on gs.id = ec.source_id
    where gs.slug = ${quoteSql(OFFICIAL_NUP_SLUG)}
  ) as official_changes,
  (
    select count(*)::int
    from public.alerts as a
    inner join public.external_changes as ec
      on a.metadata ->> 'external_change_id' = ec.id::text
    inner join public.grid_sources as gs on gs.id = ec.source_id
    where gs.slug = ${quoteSql(OFFICIAL_NUP_SLUG)}
  ) as official_alerts;
`;
}

function observationSqlValues(snapshotId, sourceId, areaId, retrievedAt, publishedAt, observations) {
  return observations
    .map(
      (obs) => `(
  ${quoteSql(snapshotId)}::uuid,
  ${quoteSql(sourceId)}::uuid,
  ${quoteSql(obs.externalId)},
  ${quoteSql(areaId)}::uuid,
  ${quoteSql(obs.observationType)},
  ${obs.valueNumeric == null ? "null" : obs.valueNumeric},
  ${obs.valueText == null ? "null" : quoteSql(obs.valueText)},
  ${obs.unit == null ? "null" : quoteSql(obs.unit)},
  'not_applicable',
  ${obs.effectiveFrom ? `${quoteSql(obs.effectiveFrom)}::timestamptz` : "null"},
  ${obs.effectiveTo ? `${quoteSql(obs.effectiveTo)}::timestamptz` : "null"},
  ${quoteSql(publishedAt)}::timestamptz,
  ${quoteSql(retrievedAt)}::timestamptz,
  'medium',
  'noxheim',
  ${sqlJson(obs.metadata)}
)`,
    )
    .join(",\n");
}

function insertObservationVersions(snapshotId, sourceId, areaId, retrievedAt, publishedAt, observations) {
  queryLocal(`
insert into public.grid_observation_versions (
  source_snapshot_id, source_id, external_id, grid_area_id, observation_type,
  value_numeric, value_text, unit, direction, effective_from, effective_to,
  published_at, retrieved_at, confidence, authority_level, raw_metadata
) values
${observationSqlValues(snapshotId, sourceId, areaId, retrievedAt, publishedAt, observations)}
on conflict (source_snapshot_id, external_id) do nothing;
`);
}

function applyChanges(previousSnapshotId, currentSnapshotId) {
  return queryLocal(`
select
  change_id,
  change_kind,
  observation_external_id,
  semantic,
  inserted,
  impact_count
from private.apply_observation_snapshot_changes(
  ${quoteSql(previousSnapshotId)}::uuid,
  ${quoteSql(currentSnapshotId)}::uuid,
  false,
  ${quoteSql(IMPACT_REASON)},
  'medium'
);
`);
}

function main() {
  const { url } = loadLocalConfig();
  console.log(`NUP change-detection fixture against ${url}`);
  console.log(FIXTURE_LABEL);
  console.log(`Fixture source slug: ${SOURCE_SLUG}`);
  console.log(`Fixture polygon (WGS84): ${AREA_WKT}`);

  const safetyBefore = requireRow(queryLocal(officialSafetySql()), "official safety before");
  const projectsBefore = requireRow(queryLocal(projectFingerprintSql()), "projects before");

  const snapshotAPayload = {
    label: FIXTURE_LABEL,
    revision: 1,
    notes: "Fixture snapshot A — not real Ei data",
  };
  const snapshotBPayload = {
    label: FIXTURE_LABEL,
    revision: 2,
    notes: "Fixture snapshot B — not real Ei data",
  };
  const hashA = contentHash(snapshotAPayload);
  const hashB = contentHash(snapshotBPayload);

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
    "fixture grid_sources",
  );

  if (source.slug === OFFICIAL_NUP_SLUG || source.authority_level !== "noxheim") {
    throw new Error("Fixture must not use the official Ei NUP source.");
  }

  queryLocal(`
insert into public.grid_areas (
  source_id, external_id, name, area_type, country_code, region, geometry,
  published_at, retrieved_at, confidence, metadata
)
select
  ${quoteSql(source.id)}::uuid,
  ${quoteSql(AREA_EXTERNAL_ID)},
  ${quoteSql("LOCAL DEVELOPMENT FIXTURE — Gävle BESS test polygon (not real Ei data)")},
  'planning_area',
  'SE',
  'Gävleborg',
  extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromtext(${quoteSql(AREA_WKT)}), 4326)),
  timestamptz '2026-01-15 08:00:00+01',
  timestamptz '2026-08-20 12:00:00+02',
  'medium',
  jsonb_build_object(
    'fixture', true,
    'label', ${quoteSql(FIXTURE_LABEL)},
    'wkt', ${quoteSql(AREA_WKT)},
    'not_real_ei_data', true
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
select id, name, external_id
from public.grid_areas
where source_id = ${quoteSql(source.id)}::uuid
  and external_id = ${quoteSql(AREA_EXTERNAL_ID)};
`),
    "fixture grid_areas",
  );

  queryLocal(`
insert into public.source_snapshots (
  source_id, retrieved_at, published_at, content_hash, raw_content, status, metadata
) values
(
  ${quoteSql(source.id)}::uuid,
  timestamptz '2026-01-15 08:00:00+01',
  timestamptz '2026-01-15 08:00:00+01',
  ${quoteSql(hashA)},
  ${sqlJson(snapshotAPayload)},
  'success',
  jsonb_build_object('fixture', true, 'label', ${quoteSql(FIXTURE_LABEL)}, 'revision', 1, 'not_real_ei_data', true)
),
(
  ${quoteSql(source.id)}::uuid,
  timestamptz '2026-08-20 12:00:00+02',
  timestamptz '2026-08-18 09:00:00+02',
  ${quoteSql(hashB)},
  ${sqlJson(snapshotBPayload)},
  'success',
  jsonb_build_object('fixture', true, 'label', ${quoteSql(FIXTURE_LABEL)}, 'revision', 2, 'not_real_ei_data', true)
)
on conflict (source_id, content_hash) do update
set metadata = excluded.metadata;
`);

  const snapshots = queryLocal(`
select id, content_hash, retrieved_at
from public.source_snapshots
where source_id = ${quoteSql(source.id)}::uuid
order by retrieved_at;
`);
  const snapA = snapshots.find((row) => row.content_hash === hashA);
  const snapB = snapshots.find((row) => row.content_hash === hashB);
  if (!snapA || !snapB) {
    throw new Error("Expected fixture snapshot A and snapshot B.");
  }

  const commonMeta = {
    fixture: true,
    label: FIXTURE_LABEL,
    not_real_ei_data: true,
  };

  const observationsA = [
    {
      externalId: "noxheim-local-nup-fixture|forecast|2028",
      observationType: "capacity_signal",
      valueNumeric: 140,
      valueText: null,
      unit: "MW",
      effectiveFrom: "2028-01-01T00:00:00+00",
      effectiveTo: "2028-12-31T23:59:59+00",
      metadata: {
        ...commonMeta,
        semantic: "forecast_transfer_capacity_need",
        planning_year: "2028",
        representation: "numeric",
      },
    },
    {
      externalId: "noxheim-local-nup-fixture|planned_investments",
      observationType: "reinforcement",
      valueNumeric: null,
      valueText: "Ja",
      unit: null,
      effectiveFrom: null,
      effectiveTo: null,
      metadata: {
        ...commonMeta,
        semantic: "planned_investments_reported",
        representation: "source_text",
      },
    },
    {
      externalId: "noxheim-local-nup-fixture|overlying_network_limitation",
      observationType: "constraint",
      valueNumeric: null,
      valueText: "Nej",
      unit: null,
      effectiveFrom: null,
      effectiveTo: null,
      metadata: {
        ...commonMeta,
        semantic: "overlying_network_limitation",
        representation: "source_text",
      },
    },
    {
      externalId: "noxheim-local-nup-fixture|flexibility|0-2",
      observationType: "other",
      valueNumeric: null,
      valueText: "Ja",
      unit: null,
      effectiveFrom: null,
      effectiveTo: null,
      metadata: {
        ...commonMeta,
        semantic: "flexibility_need",
        horizon: "0-2",
        representation: "source_text",
      },
    },
  ];

  const observationsB = [
    {
      externalId: "noxheim-local-nup-fixture|forecast|2028",
      observationType: "capacity_signal",
      valueNumeric: 150,
      valueText: null,
      unit: "MW",
      effectiveFrom: "2028-01-01T00:00:00+00",
      effectiveTo: "2028-12-31T23:59:59+00",
      metadata: {
        ...commonMeta,
        semantic: "forecast_transfer_capacity_need",
        planning_year: "2028",
        representation: "numeric",
      },
    },
    {
      externalId: "noxheim-local-nup-fixture|planned_investments",
      observationType: "reinforcement",
      valueNumeric: null,
      valueText: "Ja",
      unit: null,
      effectiveFrom: null,
      effectiveTo: null,
      metadata: {
        ...commonMeta,
        semantic: "planned_investments_reported",
        representation: "source_text",
      },
    },
    {
      externalId: "noxheim-local-nup-fixture|overlying_network_limitation",
      observationType: "constraint",
      valueNumeric: null,
      valueText: "Det kan finnas",
      unit: null,
      effectiveFrom: null,
      effectiveTo: null,
      metadata: {
        ...commonMeta,
        semantic: "overlying_network_limitation",
        representation: "source_text",
      },
    },
    {
      externalId: "noxheim-local-nup-fixture|flexibility|3-5",
      observationType: "other",
      valueNumeric: null,
      valueText: "Ja",
      unit: null,
      effectiveFrom: null,
      effectiveTo: null,
      metadata: {
        ...commonMeta,
        semantic: "flexibility_need",
        horizon: "3-5",
        representation: "source_text",
      },
    },
  ];

  insertObservationVersions(
    snapA.id,
    source.id,
    area.id,
    "2026-01-15 08:00:00+01",
    "2026-01-15 08:00:00+01",
    observationsA,
  );
  insertObservationVersions(
    snapB.id,
    source.id,
    area.id,
    "2026-08-20 12:00:00+02",
    "2026-08-18 09:00:00+02",
    observationsB,
  );

  const versionCounts = requireRow(
    queryLocal(`
select
  (select count(*)::int from public.grid_observation_versions where source_snapshot_id = ${quoteSql(snapA.id)}::uuid) as snapshot_a,
  (select count(*)::int from public.grid_observation_versions where source_snapshot_id = ${quoteSql(snapB.id)}::uuid) as snapshot_b;
`),
    "version counts",
  );

  const diffs = queryLocal(`
select change_kind, external_id, semantic, before_value, after_value, grid_area_id
from private.diff_observation_snapshots(
  ${quoteSql(snapA.id)}::uuid,
  ${quoteSql(snapB.id)}::uuid
)
order by change_kind, external_id;
`);

  const added = diffs.filter((row) => row.change_kind === "added");
  const removed = diffs.filter((row) => row.change_kind === "removed");
  const changed = diffs.filter((row) => row.change_kind === "changed");
  const unchanged =
    Number(versionCounts.snapshot_a) - changed.length - removed.length;

  const firstApply = applyChanges(snapA.id, snapB.id);
  const secondApply = applyChanges(snapA.id, snapB.id);

  const changes = queryLocal(`
select
  ec.id,
  ec.observation_external_id,
  ec.change_type,
  ec.title,
  ec.severity,
  ec.grid_area_id,
  ec.before_value,
  ec.after_value,
  ec.metadata ->> 'semantic' as semantic,
  ec.metadata ->> 'change_kind' as change_kind,
  ga.name as planning_area
from public.external_changes as ec
left join public.grid_areas as ga on ga.id = ec.grid_area_id
where ec.source_id = ${quoteSql(source.id)}::uuid
  and ec.previous_snapshot_id = ${quoteSql(snapA.id)}::uuid
  and ec.current_snapshot_id = ${quoteSql(snapB.id)}::uuid
order by ec.observation_external_id;
`);

  const impactDetails = queryLocal(`
select
  ci.id as change_impact_id,
  ci.external_change_id,
  ci.match_type,
  ci.impact_level,
  ci.reason,
  ci.confidence,
  p.name as project_name,
  p.slug as project_slug
from public.change_impacts as ci
inner join public.projects as p on p.id = ci.project_id
inner join public.external_changes as ec on ec.id = ci.external_change_id
where ec.source_id = ${quoteSql(source.id)}::uuid
  and ec.previous_snapshot_id = ${quoteSql(snapA.id)}::uuid
  and ec.current_snapshot_id = ${quoteSql(snapB.id)}::uuid
order by p.name, ec.observation_external_id;
`);

  const spatialMatches = queryLocal(`
select
  p.name,
  p.slug,
  round(extensions.st_x(ps.geom)::numeric, 4) as longitude,
  round(extensions.st_y(ps.geom)::numeric, 4) as latitude,
  extensions.st_intersects(ga.geometry, ps.geom) as intersects
from public.projects as p
inner join public.project_sites as ps on ps.project_id = p.id and ps.is_primary
cross join public.grid_areas as ga
where ga.id = ${quoteSql(area.id)}::uuid
order by intersects desc, p.name;
`);

  const alerts = queryLocal(`
select count(*)::int as count
from public.alerts as a
inner join public.external_changes as ec
  on a.metadata ->> 'external_change_id' = ec.id::text
where ec.source_id = ${quoteSql(source.id)}::uuid;
`);

  const safetyAfter = requireRow(queryLocal(officialSafetySql()), "official safety after");
  const projectsAfter = requireRow(queryLocal(projectFingerprintSql()), "projects after");

  const matchedProjects = spatialMatches.filter((row) => asBool(row.intersects));
  const uniqueMatched = [...new Map(matchedProjects.map((row) => [row.slug, row])).values()];
  const uniqueImpactProjects = [...new Set(impactDetails.map((row) => row.project_slug))];

  console.log("\n========== NUP change detection fixture ==========");
  console.log(`Snapshots compared: A=${snapA.id} → B=${snapB.id}`);
  console.log(`Observation counts: A=${versionCounts.snapshot_a} B=${versionCounts.snapshot_b}`);
  console.log(`Added: ${added.length}`);
  console.log(`Removed: ${removed.length}`);
  console.log(`Changed: ${changed.length}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`External changes created: ${changes.length}`);
  console.log(`Planning areas affected: ${new Set(changes.map((row) => row.grid_area_id).filter(Boolean)).size}`);
  console.log(`Projects spatially matched: ${uniqueMatched.map((row) => row.name).join(", ") || "(none)"}`);
  console.log(`Change impacts created: ${impactDetails.length}`);
  console.log(`Fixture alerts created: ${alerts[0]?.count ?? 0}`);
  console.log(`First apply inserted: ${firstApply.filter((row) => asBool(row.inserted)).length}`);
  console.log(`Second apply inserted: ${secondApply.filter((row) => asBool(row.inserted)).length}`);

  console.log("\n--- Changes ---");
  for (const row of changes) {
    const matched = impactDetails
      .filter((impact) => impact.external_change_id === row.id)
      .map((impact) => impact.project_name);
    console.log(`  ${row.change_kind} · ${row.semantic} · ${row.observation_external_id}`);
    console.log(`    title=${row.title}`);
    console.log(`    type=${row.change_type} severity=${row.severity}`);
    console.log(`    before=${JSON.stringify(row.before_value)}`);
    console.log(`    after=${JSON.stringify(row.after_value)}`);
    console.log(`    planning area=${row.planning_area}`);
    console.log(`    matched projects=${matched.join(", ") || "(none)"}`);
  }

  console.log("\n--- Spatial evidence ---");
  for (const row of spatialMatches) {
    const flag = asBool(row.intersects) ? "MATCH" : "no";
    console.log(`  [${flag}] ${row.name} (${row.slug}) lng=${row.longitude} lat=${row.latitude}`);
  }

  console.log("\n--- Impact reasons ---");
  for (const row of impactDetails) {
    console.log(`  ${row.project_name} · ${row.match_type} · ${row.impact_level} · ${row.confidence}`);
    console.log(`    ${row.reason}`);
  }

  const unexpectedKinds = diffs.filter(
    (row) => !["added", "removed", "changed"].includes(row.change_kind),
  );
  if (unexpectedKinds.length > 0) {
    throw new Error("Diff produced an unexpected change kind.");
  }
  if (added.length !== 1 || removed.length !== 1 || changed.length !== 2 || unchanged !== 1) {
    throw new Error(
      `Expected added=1 removed=1 changed=2 unchanged=1, got added=${added.length} removed=${removed.length} changed=${changed.length} unchanged=${unchanged}.`,
    );
  }
  if (changes.some((row) => row.observation_external_id === "noxheim-local-nup-fixture|planned_investments")) {
    throw new Error("Unchanged planned-investments observation produced an external_change.");
  }
  if (changes.length !== 4) {
    throw new Error(`Expected 4 external_changes, got ${changes.length}.`);
  }
  if (changes.some((row) => row.severity !== "info")) {
    throw new Error("Fixture NUP changes must default to severity=info.");
  }
  if (impactDetails.some((row) => row.reason !== IMPACT_REASON)) {
    throw new Error("Impact reason did not match the NUP planning-area statement.");
  }
  if (impactDetails.some((row) => row.match_type !== "geographic" || row.impact_level !== "review")) {
    throw new Error("Impacts must be geographic / review without inferred connection risk.");
  }
  if (uniqueImpactProjects.sort().join("|") !== uniqueMatched.map((row) => row.slug).sort().join("|")) {
    throw new Error("Change impacts must match PostGIS intersections only. No hardcoded project IDs.");
  }
  if (uniqueMatched.some((row) => row.slug === "falun-bess")) {
    throw new Error("Fixture polygon must not match Falun BESS.");
  }
  if (Number(alerts[0]?.count ?? 0) !== 0) {
    throw new Error("Fixture must not create customer alerts.");
  }
  if (secondApply.some((row) => asBool(row.inserted))) {
    throw new Error("Second apply duplicated external_changes.");
  }
  if (firstApply.length !== secondApply.length || firstApply.length !== changes.length) {
    throw new Error("Idempotent apply must return the same change set.");
  }
  if (
    Number(safetyBefore.official_snapshots) !== Number(safetyAfter.official_snapshots) ||
    Number(safetyBefore.official_versions) !== Number(safetyAfter.official_versions) ||
    Number(safetyBefore.official_changes) !== Number(safetyAfter.official_changes) ||
    Number(safetyBefore.official_alerts) !== Number(safetyAfter.official_alerts)
  ) {
    throw new Error("Fixture mutated official Ei NUP history.");
  }
  if (
    projectsBefore.fingerprint !== projectsAfter.fingerprint ||
    Number(projectsBefore.project_count) !== Number(projectsAfter.project_count)
  ) {
    throw new Error("Fixture mutated customer project data.");
  }

  console.log("\nIdempotent NUP change detection succeeded. Official Ei history untouched. No alerts.");
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
