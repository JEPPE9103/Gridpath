/**
 * Idempotent SAMPLE CUSTOMER DATA seed/reset for the dedicated sales-demo organization.
 *
 * Never writes official Grid Intelligence tables.
 * Never writes external_changes or alerts.
 * Never touches another organization.
 *
 * Remote (Design Partner Cloud) requires:
 *   NOXHEIM_ALLOW_REMOTE_DEMO_SEED=true
 *   NOXHEIM_REMOTE_PROJECT_REF=krgzpgqmnzljwlwptmcn
 *
 * Or use: npm run demo:reset
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DESIGN_PARTNER_CLOUD_PROJECT_REF,
  queryIngestSql,
  resolveDemoSeedTarget,
  runDemoSeedSql,
} from "./lib/demo-seed-target.mjs";
import {
  DEMO_ALLOWED_SLUGS,
  DEMO_ORG_ID,
  DEMO_ORG_NAME,
  DEMO_ORG_SLUG,
  PROJECTS,
} from "./lib/sales-demo-portfolio.mjs";

const FORBIDDEN_TABLE_TOKENS = [
  "grid_sources",
  "grid_areas",
  "grid_observations",
  "observation_versions",
  "source_snapshots",
  "external_changes",
  "change_impacts",
  "alerts",
];

function lit(value) {
  if (value === null || value === undefined) {
    return "null";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildResetSql() {
  const projectInserts = PROJECTS.map((project) => {
    return `insert into public.projects (
  id, organization_id, grid_operator_id, name, slug, location, region, technology,
  import_mw, export_mw, voltage_level, connection_stage, connection_outlook,
  confidence, target_cod, description
) values (
  ${lit(project.id)},
  ${lit(DEMO_ORG_ID)},
  ${lit(project.operatorId)},
  ${lit(project.name)},
  ${lit(project.slug)},
  ${lit(project.location)},
  ${lit(project.region)},
  ${lit(project.technology)},
  ${project.mw},
  ${project.mw},
  ${lit(project.voltageLevel)},
  ${lit(project.stage)},
  ${lit(project.outlook)},
  ${lit(project.confidence)},
  ${lit(project.targetCod)},
  ${lit(project.description)}
);`;
  }).join("\n\n");

  const siteInserts = PROJECTS.map((project) => {
    return `insert into public.project_sites (
  id, project_id, name, location, geom, is_primary
) values (
  ${lit(project.siteId)},
  ${lit(project.id)},
  ${lit(`${project.name} site`)},
  ${lit(project.location)},
  extensions.st_setsrid(extensions.st_makepoint(${project.longitude}, ${project.latitude}), 4326),
  true
);`;
  }).join("\n\n");

  const caseInserts = PROJECTS.filter((project) => project.case && project.caseId)
    .map((project) => {
      const item = project.case;
      return `insert into public.connection_cases (
  id, project_id, grid_operator_id, case_id, stage, status,
  submitted_at, next_milestone, deadline, notes
) values (
  ${lit(project.caseId)},
  ${lit(project.id)},
  ${lit(project.operatorId)},
  ${lit(item.reference)},
  ${lit(item.stage)},
  ${lit(item.status)},
  ${lit(item.submittedAt)},
  ${lit(item.nextMilestone)},
  ${lit(item.deadline)},
  ${lit(item.notes)}
);`;
    })
    .join("\n\n");

  const requirementInserts = PROJECTS.flatMap((project) =>
    project.requirements.map((item) => {
      return `insert into public.project_requirements (
  id, project_id, connection_case_id, label, status, required, category
) values (
  ${lit(item.id)},
  ${lit(project.id)},
  ${lit(project.caseId)},
  ${lit(item.label)},
  ${lit(item.status)},
  ${item.required ? "true" : "false"},
  ${lit(item.category)}
);`;
    }),
  ).join("\n");

  const documentInserts = PROJECTS.flatMap((project) =>
    project.documents.map((item) => {
      return `insert into public.documents (
  id, project_id, name, category, status
) values (
  ${lit(item.id)},
  ${lit(project.id)},
  ${lit(item.name)},
  ${lit(item.category)},
  ${lit(item.status)}
);`;
    }),
  ).join("\n");

  return `-- SAMPLE CUSTOMER DATA ONLY for the dedicated sales-demo organization.
-- Does not modify official Grid Intelligence, external_changes, or alerts.

begin;

update public.organizations
set
  name = ${lit(DEMO_ORG_NAME)},
  slug = ${lit(DEMO_ORG_SLUG)}
where id = ${lit(DEMO_ORG_ID)}
  and slug in (${DEMO_ALLOWED_SLUGS.map(lit).join(", ")});

delete from public.projects
where organization_id = ${lit(DEMO_ORG_ID)};

${projectInserts}

${siteInserts}

${caseInserts}

${requirementInserts}

${documentInserts}

commit;
`;
}

function assertSqlSafe(sql) {
  const stripped = sql.replace(/--.*$/gm, "").toLowerCase();
  for (const token of FORBIDDEN_TABLE_TOKENS) {
    if (stripped.includes(token)) {
      throw new Error(`Refusing to run: generated SQL mentions forbidden table ${token}.`);
    }
  }
  if (stripped.includes("drop schema") || stripped.includes("truncate public.organizations")) {
    throw new Error("Refusing to run: destructive SQL detected.");
  }
}

const target = resolveDemoSeedTarget();

if (target.mode === "remote" && target.projectRef !== DESIGN_PARTNER_CLOUD_PROJECT_REF) {
  throw new Error("Remote demo seed refused: project ref is not allowlisted.");
}

const orgRows = queryIngestSql(
  target,
  `select id, name, slug from public.organizations where id = '${DEMO_ORG_ID}';`,
);
const org = orgRows[0];
if (!org) {
  throw new Error(
    `Refusing to run: dedicated demo organization ${DEMO_ORG_ID} was not found. Will not create a new organization or seed another tenant.`,
  );
}
if (!DEMO_ALLOWED_SLUGS.includes(org.slug)) {
  throw new Error(
    `Refusing to run: organization ${org.id} has slug "${org.slug}", which is not the allowlisted demo workspace.`,
  );
}

const existingProjects = queryIngestSql(
  target,
  `select id, name, slug from public.projects where organization_id = '${DEMO_ORG_ID}' order by name;`,
);
const otherOrgProjects = queryIngestSql(
  target,
  `select count(*)::int as count from public.projects where organization_id <> '${DEMO_ORG_ID}';`,
);
const otherOrgCount = queryIngestSql(
  target,
  `select count(*)::int as count from public.organizations where id <> '${DEMO_ORG_ID}';`,
);

console.log("NOXHEIM sales demo reset");
console.log("------------------------");
console.log(`mode: ${target.mode}`);
console.log(`project_ref: ${target.projectRef ?? "(local)"}`);
console.log(`organization_id: ${org.id}`);
console.log(`organization_name: ${org.name} → ${DEMO_ORG_NAME}`);
console.log(`organization_slug: ${org.slug} → ${DEMO_ORG_SLUG}`);
console.log(`existing demo-org projects (${existingProjects.length}):`);
for (const row of existingProjects) {
  console.log(`  - ${row.name} (${row.slug}) [${row.id}]`);
}
console.log(`other organizations (untouched): ${otherOrgCount[0]?.count ?? 0}`);
console.log(`projects in other organizations (untouched): ${otherOrgProjects[0]?.count ?? 0}`);
console.log("official grid tables: not modified");
console.log("external_changes / alerts: not created");
console.log(`will insert ${PROJECTS.length} sample projects belonging ONLY to ${DEMO_ORG_ID}`);

const sql = buildResetSql();
assertSqlSafe(sql);

const dir = mkdtempSync(path.join(tmpdir(), "noxheim-demo-seed-"));
const file = path.join(dir, "reset.sql");
try {
  writeFileSync(file, sql, "utf8");
  runDemoSeedSql(target, file);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const afterOrg = queryIngestSql(
  target,
  `select id, name, slug from public.organizations where id = '${DEMO_ORG_ID}';`,
)[0];
const afterProjects = queryIngestSql(
  target,
  `select name, slug from public.projects where organization_id = '${DEMO_ORG_ID}' order by name;`,
);
const afterOther = queryIngestSql(
  target,
  `select count(*)::int as count from public.projects where organization_id <> '${DEMO_ORG_ID}';`,
);

if (!afterOrg || afterOrg.slug !== DEMO_ORG_SLUG) {
  throw new Error("Demo reset finished but organization slug did not match the dedicated demo slug.");
}
if (afterProjects.length !== PROJECTS.length) {
  throw new Error(
    `Demo reset finished with ${afterProjects.length} projects; expected ${PROJECTS.length}.`,
  );
}
if ((afterOther[0]?.count ?? 0) !== (otherOrgProjects[0]?.count ?? 0)) {
  throw new Error("Refusing to continue: project count outside the demo organization changed.");
}

console.log("Result: SUCCESS");
console.log(`canonical projects: ${afterProjects.length}`);
for (const row of afterProjects) {
  console.log(`  - ${row.name} (${row.slug})`);
}
console.log("Hero: Stockholm North BESS /projects/stockholm-north-bess");
console.log("Compare: Uppsala Storage, Stockholm North BESS, Gävle BESS");
